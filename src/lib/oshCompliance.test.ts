import { describe, it, expect } from 'vitest';
import { validateWorkingHours, checkWomenNightShift } from './oshCompliance';

describe('OSH Compliance - Working Hours', () => {
  it('should be compliant and 0 OT for a normal 40 hr week', () => {
    const result = validateWorkingHours({
      employeeId: 'EMP1',
      state: 'Maharashtra',
      weekStartDate: '2026-03-09',
      quarterlyOvertimeHoursAccumulated: 10,
      timesheetEntries: [
        { date: '2026-03-09', hoursWorked: 8, spreadOverHours: 9 },
        { date: '2026-03-10', hoursWorked: 8, spreadOverHours: 9 },
        { date: '2026-03-11', hoursWorked: 8, spreadOverHours: 9 },
        { date: '2026-03-12', hoursWorked: 8, spreadOverHours: 9 },
        { date: '2026-03-13', hoursWorked: 8, spreadOverHours: 9 },
      ]
    });

    expect(result.isCompliant).toBe(true);
    expect(result.totalHoursWorked).toBe(40);
    expect(result.overtimeHoursDue).toBe(0);
    expect(result.violations.length).toBe(0);
  });

  it('should flag daily overtime', () => {
    const result = validateWorkingHours({
      employeeId: 'EMP2',
      state: 'National',
      weekStartDate: '2026-03-09',
      quarterlyOvertimeHoursAccumulated: 0,
      timesheetEntries: [
        { date: '2026-03-09', hoursWorked: 10, spreadOverHours: 11 }, // 2 hours OT daily, spread over fail
      ]
    });

    // Failing spread over limit (10.5) makes it non-compliant overall technically
    expect(result.isCompliant).toBe(false); 
    expect(result.overtimeHoursDue).toBe(2);
    expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
  });

  it('should flag quarterly limit breaches', () => {
    const result = validateWorkingHours({
      employeeId: 'EMP3',
      state: 'National',
      weekStartDate: '2026-03-09',
      quarterlyOvertimeHoursAccumulated: 124, // ALmost at 125 limit
      timesheetEntries: [
        { date: '2026-03-09', hoursWorked: 10, spreadOverHours: 10 }, 
      ]
    });

    expect(result.isCompliant).toBe(false); 
    expect(result.violations.some(v => v.issue.includes('Quarterly overtime ceiling'))).toBe(true);
  });
});

describe('OSH Compliance - Women Night Shifts', () => {
  it('should prevent women night shifts without consent', () => {
    const result = checkWomenNightShift('Female', 20, 4, false); // 8PM - 4AM
    expect(result.allowed).toBe(false);
    expect(result.warning).toContain('consent');
  });

  it('should allow women night shifts with consent but warn about safeguards', () => {
    const result = checkWomenNightShift('Female', 20, 4, true); 
    expect(result.allowed).toBe(true);
    expect(result.warning).toContain('safeguards');
  });

  it('should ignore men on night shift', () => {
    const result = checkWomenNightShift('Male', 20, 4, false); 
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeUndefined();
  });
});
