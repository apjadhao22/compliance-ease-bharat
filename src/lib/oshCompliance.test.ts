import { describe, it, expect } from 'vitest';
import { validateWorkingHours, checkWomenNightShift } from './oshCompliance';

// ─── validateWorkingHours ────────────────────────────────────────────────────

describe('OSH Compliance Rules', () => {

  describe('validateWorkingHours — National / Default', () => {
    it('should flag daily overtime and spread-over violation', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP1',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [
          { date: '2026-03-09', hoursWorked: 10, spreadOverHours: 11 }
        ],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.isCompliant).toBe(false); // spread > 10.5
      expect(result.overtimeHoursDue).toBe(2);
      expect(result.violations.some(v => v.issue.includes('limit exceeded by 2'))).toBe(true);
      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
    });

    it('should be fully compliant within national default limits (8hr/day)', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_OK',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [
          { date: '2026-03-09', hoursWorked: 8, spreadOverHours: 9 },
          { date: '2026-03-10', hoursWorked: 8, spreadOverHours: 9 },
          { date: '2026-03-11', hoursWorked: 8, spreadOverHours: 9 },
          { date: '2026-03-12', hoursWorked: 8, spreadOverHours: 9 },
          { date: '2026-03-13', hoursWorked: 8, spreadOverHours: 9 },
        ],
        quarterlyOvertimeHoursAccumulated: 0
      });

      // 5 × 8 = 40 hrs < 48hr weekly limit
      expect(result.isCompliant).toBe(true);
      expect(result.violations.length).toBe(0);
      expect(result.totalHoursWorked).toBe(40);
      expect(result.overtimeHoursDue).toBe(0);
    });

    it('should flag weekly limit when 7-day total exceeds 48 hours', () => {
      // 7 days × 9 hours = 63 hours — 15hr over weekly limit
      const entries = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hoursWorked: 9,
        spreadOverHours: 10
      }));
      const result = validateWorkingHours({
        employeeId: 'EMP_WEEKLY',
        state: 'National/Default',
        weekStartDate: '2026-03-01',
        timesheetEntries: entries,
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.totalHoursWorked).toBe(63);
      expect(result.violations.some(v => v.issue.includes('Weekly limit exceeded'))).toBe(true);
      expect(result.overtimeHoursDue).toBeGreaterThan(0);
    });

    it('should flag quarterly OT ceiling at 126hrs (cap is 125hrs national)', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_QOT',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 10 }], // 2hr OT
        quarterlyOvertimeHoursAccumulated: 124 // 124 + 2 = 126 > 125
      });

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('Quarterly overtime ceiling'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('Quarterly'))?.limitRule).toBe(125);
    });

    it('should carry accumulated quarterly OT correctly in the result', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_CARRY',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 10 }], // 2hr OT
        quarterlyOvertimeHoursAccumulated: 50
      });

      expect(result.newQuarterlyOvertimeAccumulated).toBe(52); // 50 + 2
    });
  });

  // ── State Overrides ──────────────────────────────────────────────────────

  describe('validateWorkingHours — Maharashtra (9hr daily, 125hr quarterly cap)', () => {
    it('should use state overrides when provided — 9hr day is not overtime', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP2',
        state: 'Maharashtra',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 9, spreadOverHours: 10 }],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.isCompliant).toBe(true);
      expect(result.overtimeHoursDue).toBe(0);
      expect(result.violations.length).toBe(0);
    });

    it('should use 125hr quarterly cap for Maharashtra — no flag at 101hr', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_MH_QOT',
        state: 'Maharashtra',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 10 }], // 1hr OT
        quarterlyOvertimeHoursAccumulated: 100 // 100 + 1 = 101 < 125
      });

      expect(result.isCompliant).toBe(true);
      expect(result.violations.some(v => v.issue.includes('Quarterly'))).toBe(false);
    });
  });

  describe('validateWorkingHours — Karnataka (12hr spread-over limit)', () => {
    it('should NOT flag 11hr spread-over for Karnataka (limit is 12)', () => {
      // National default spread-over = 10.5hrs; Karnataka = 12hrs
      const result = validateWorkingHours({
        employeeId: 'EMP_KA_OK',
        state: 'Karnataka',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 9, spreadOverHours: 11 }],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(false);
    });

    it('should flag 11hr spread-over for National/Default (limit is 10.5)', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_NAT_SPREAD',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 9, spreadOverHours: 11 }],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
    });

    it('should flag 13hr spread-over for Karnataka (exceeds 12hr limit)', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_KA_OVER',
        state: 'Karnataka',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 9, spreadOverHours: 13 }],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('spread-over'))?.limitRule).toBe(12);
    });
  });

  describe('validateWorkingHours — Telangana (75hr quarterly OT cap)', () => {
    it('should flag quarterly OT at 76hr for Telangana — cap is 75, not 125', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_TS_QOT',
        state: 'Telangana',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 11 }], // 1hr OT
        quarterlyOvertimeHoursAccumulated: 75 // 75 + 1 = 76 > 75
      });

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('Quarterly overtime ceiling'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('Quarterly'))?.limitRule).toBe(75);
    });

    it('should NOT flag quarterly OT at 74hr for Telangana', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_TS_OK',
        state: 'Telangana',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 11 }], // 1hr OT
        quarterlyOvertimeHoursAccumulated: 73 // 73 + 1 = 74 < 75
      });

      expect(result.violations.some(v => v.issue.includes('Quarterly overtime ceiling'))).toBe(false);
    });

    it('same hours cross Telangana 75hr cap but NOT Maharashtra 125hr cap', () => {
      const sharedInput = {
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 10 }],
        quarterlyOvertimeHoursAccumulated: 100 // 100 + 2 = 102 — between the two caps
      };
      const tsResult = validateWorkingHours({ employeeId: 'TS', state: 'Telangana', ...sharedInput });
      const mhResult = validateWorkingHours({ employeeId: 'MH', state: 'Maharashtra', ...sharedInput });

      expect(tsResult.violations.some(v => v.issue.includes('Quarterly'))).toBe(true);  // 102 > 75
      expect(mhResult.violations.some(v => v.issue.includes('Quarterly'))).toBe(false); // 102 < 125
    });
  });

  // ── Violation Object Shape ───────────────────────────────────────────────

  describe('violation object shape', () => {
    it('every violation has issue:string, limitRule:number, actualValue:number', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_SHAPE',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 12 }],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.violations.length).toBeGreaterThan(0);
      for (const v of result.violations) {
        expect(typeof v.issue).toBe('string');
        expect(typeof v.limitRule).toBe('number');
        expect(typeof v.actualValue).toBe('number');
      }
    });

    it('daily violation includes the entry date', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_DATE',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 10 }],
        quarterlyOvertimeHoursAccumulated: 0
      });

      const dailyViolation = result.violations.find(v => v.date);
      expect(dailyViolation?.date).toBe('2026-03-09');
    });

    it('overtime rate multiplier is always 2.0', () => {
      const result = validateWorkingHours({
        employeeId: 'EMP_OT_RATE',
        state: 'National/Default',
        weekStartDate: '2026-03-09',
        timesheetEntries: [{ date: '2026-03-09', hoursWorked: 10, spreadOverHours: 10 }],
        quarterlyOvertimeHoursAccumulated: 0
      });

      expect(result.statutoryOvertimeRateMultiplier).toBe(2.0);
    });
  });

  // ── checkWomenNightShift ─────────────────────────────────────────────────

  describe('checkWomenNightShift', () => {
    it('should block female without consent (8PM to 4AM)', () => {
      const res = checkWomenNightShift('female', 20, 4, false);
      expect(res.allowed).toBe(false);
      expect(res.warning).toContain('Statutory prohibition');
    });

    it('should allow female WITH consent — returns safeguard warning', () => {
      const res = checkWomenNightShift('female', 20, 4, true);
      expect(res.allowed).toBe(true);
      expect(res.warning).toContain('safeguards');
    });

    it('should allow male regardless of shift or consent', () => {
      const res = checkWomenNightShift('male', 20, 4, false);
      expect(res.allowed).toBe(true);
      expect(res.warning).toBeUndefined();
    });

    it('should treat null/undefined gender as non-female (allowed)', () => {
      expect(checkWomenNightShift(null, 20, 4, false).allowed).toBe(true);
      expect(checkWomenNightShift(undefined, 20, 4, false).allowed).toBe(true);
    });

    it('should detect shift crossing midnight as night shift (10PM to 6AM)', () => {
      const res = checkWomenNightShift('female', 22, 6, false);
      expect(res.allowed).toBe(false);
    });

    it('should allow daytime shift (9AM to 5PM) for female without consent', () => {
      const res = checkWomenNightShift('female', 9, 17, false);
      expect(res.allowed).toBe(true);
    });

    it('citation should reference OSH Code Section 43', () => {
      const res = checkWomenNightShift('female', 20, 4, false);
      expect(res.citation.sectionOrRule).toContain('43');
      expect(res.citation.codeName).toContain('Occupational Safety');
    });
  });

});
