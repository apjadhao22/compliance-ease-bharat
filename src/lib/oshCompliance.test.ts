import { describe, it, expect } from 'vitest';
import { validateWorkingHours, checkWomenNightShift } from './oshCompliance';

describe('OSH Compliance Rules', () => {

  describe('validateWorkingHours', () => {
    it('should flag normal overtime', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP1',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [
          { date: '2026-03-09', hoursWorked: 10, spreadOverHours: 11 }
        ],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.isCompliant).toBe(false); // Because spread is > 10.5
      expect(result.overtimeHoursDue).toBe(2);
      expect(result.violations.some(v => v.issue.includes('limit exceeded by 2'))).toBe(true);
      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
    });

    it('should use state overrides when provided', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP2',
        state: 'Maharashtra',
        weekStartDate: '2026-03-09',
        timesheetEntries: [
          { date: '2026-03-09', hoursWorked: 9, spreadOverHours: 10 }
        ],
        quarterlyOvertimeHoursAccumulated: 0
      });

      // Maharashtra config allows 9 daily hours, so this should not be overtime
      expect(result.isCompliant).toBe(true);
      expect(result.overtimeHoursDue).toBe(0);
      expect(result.violations.length).toBe(0);
    });
  });

  describe('checkWomenNightShift', () => {
    it('should block female without consent for night shift', () => {
      const res = checkWomenNightShift('female', 20, 4, false); // 8PM to 4AM
      expect(res.allowed).toBe(false);
      expect(res.warning).toContain('Statutory prohibition');
    });

    it('should allow female with consent for night shift', () => {
      const res = checkWomenNightShift('female', 20, 4, true);
      expect(res.allowed).toBe(true);
    });

    it('should ignore male for night shift rules', () => {
      const res = checkWomenNightShift('male', 20, 4, false);
      expect(res.allowed).toBe(true);
    });
  });

});
