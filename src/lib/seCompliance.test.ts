import { describe, it, expect } from 'vitest';
import { validateSEWorkingHours } from './seCompliance';
import { TimesheetEntry } from './oshCompliance';

describe('S&E Compliance - Working Hours', () => {

  // ── Maharashtra ──────────────────────────────────────────────────────────

  describe('Maharashtra (9hr daily, 10.5hr spread-over, 48hr weekly)', () => {
    it('should validate compliant shifts', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 9, spreadOverHours: 10 },
        { date: '2026-03-02', hoursWorked: 9, spreadOverHours: 10.5 },
        { date: '2026-03-03', hoursWorked: 8, spreadOverHours: 9 },
      ];
      const result = validateSEWorkingHours('Maharashtra', entries);

      expect(result.stateRuleApplied).toBe('Maharashtra');
      expect(result.isCompliant).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should flag daily hours > 9 for Maharashtra', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 10, spreadOverHours: 10 },
      ];
      const result = validateSEWorkingHours('Maharashtra', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('Daily working hours'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('Daily working hours'))?.limit).toBe(9);
    });

    it('should flag spread-over > 10.5 hrs for Maharashtra', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 9, spreadOverHours: 11 },
      ];
      const result = validateSEWorkingHours('Maharashtra', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('spread-over'))?.limit).toBe(10.5);
    });
  });

  // ── Delhi ────────────────────────────────────────────────────────────────

  describe('Delhi (9hr daily, 10.5hr spread-over, 48hr weekly)', () => {
    it('should flag both daily hours and spread-over in a single entry', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 10, spreadOverHours: 11 }, // both exceed limits
      ];
      const result = validateSEWorkingHours('Delhi', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].issue).toContain('Daily working hours');
      expect(result.violations[1].issue).toContain('Daily spread-over');
    });
  });

  // ── Karnataka ────────────────────────────────────────────────────────────

  describe('Karnataka (9hr daily, 12hr spread-over, 48hr weekly)', () => {
    it('should NOT flag 11hr spread-over for Karnataka — limit is 12, not 10.5', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 9, spreadOverHours: 11 },
      ];
      const result = validateSEWorkingHours('Karnataka', entries);

      expect(result.isCompliant).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should flag spread-over > 12 hrs for Karnataka', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 9, spreadOverHours: 13 },
      ];
      const result = validateSEWorkingHours('Karnataka', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('spread-over'))?.limit).toBe(12);
    });
  });

  // ── Telangana ────────────────────────────────────────────────────────────

  describe('Telangana (9hr daily, 12hr spread-over, 48hr weekly — TS S&E Act 1988)', () => {
    it('should be compliant with 9hr day and 11hr spread-over', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 9, spreadOverHours: 11 },
        { date: '2026-03-02', hoursWorked: 8, spreadOverHours: 9 },
      ];
      const result = validateSEWorkingHours('Telangana', entries);

      expect(result.stateRuleApplied).toBe('Telangana');
      expect(result.isCompliant).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should flag daily hours > 9 for Telangana', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 10, spreadOverHours: 10 },
      ];
      const result = validateSEWorkingHours('Telangana', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('Daily working hours'))).toBe(true);
    });

    it('should flag spread-over > 12 hrs for Telangana', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 9, spreadOverHours: 13 },
      ];
      const result = validateSEWorkingHours('Telangana', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('spread-over'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('spread-over'))?.limit).toBe(12);
    });

    it('should flag weekly total > 48hrs for Telangana', () => {
      // 6 days × 9hr = 54hr > 48hr weekly limit
      const entries: TimesheetEntry[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hoursWorked: 9,
        spreadOverHours: 10
      }));
      const result = validateSEWorkingHours('Telangana', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('Weekly working hours'))).toBe(true);
      expect(result.violations.find(v => v.issue.includes('Weekly'))?.limit).toBe(48);
      expect(result.violations.find(v => v.issue.includes('Weekly'))?.actual).toBe(54);
    });

    it('should confirm Telangana has a stricter spread-over than Delhi but same as Karnataka', () => {
      // Both Telangana and Karnataka allow 12hr spread-over vs Delhi 10.5
      const entry: TimesheetEntry[] = [{ date: '2026-03-01', hoursWorked: 9, spreadOverHours: 11 }];

      const tsResult = validateSEWorkingHours('Telangana', entry);
      const kaResult = validateSEWorkingHours('Karnataka', entry);
      const dlResult = validateSEWorkingHours('Delhi', entry);

      expect(tsResult.isCompliant).toBe(true);  // 11 ≤ 12 — OK
      expect(kaResult.isCompliant).toBe(true);  // 11 ≤ 12 — OK
      expect(dlResult.isCompliant).toBe(false); // 11 > 10.5 — violation
    });
  });

  // ── Weekly aggregate ─────────────────────────────────────────────────────

  describe('Weekly working hour limit', () => {
    it('should flag when multi-day total exceeds 48hrs', () => {
      const entries: TimesheetEntry[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hoursWorked: 9,
        spreadOverHours: 10
      })); // 6 × 9 = 54hrs
      const result = validateSEWorkingHours('Maharashtra', entries);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.issue.includes('Weekly'))).toBe(true);
    });

    it('should be compliant exactly at 48hr week', () => {
      // 6 days × 8hr = 48hr
      const entries: TimesheetEntry[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hoursWorked: 8,
        spreadOverHours: 9
      }));
      const result = validateSEWorkingHours('Maharashtra', entries);

      expect(result.violations.some(v => v.issue.includes('Weekly'))).toBe(false);
    });
  });

  // ── Unknown state ────────────────────────────────────────────────────────

  describe('Unknown / unconfigured state', () => {
    it('should return warning for unlisted state and remain compliant (graceful degradation)', () => {
      const entries: TimesheetEntry[] = [
        { date: '2026-03-01', hoursWorked: 10, spreadOverHours: 11 },
      ];
      const result = validateSEWorkingHours('Goa', entries);

      expect(result.isCompliant).toBe(true);
      expect(result.stateRuleApplied).toBeNull();
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('No specific S&E working hours config found');
    });
  });

  // ── Violation shape ──────────────────────────────────────────────────────

  describe('violation object shape', () => {
    it('each violation has issue, date?, limit, actual', () => {
      const entries: TimesheetEntry[] = [{ date: '2026-03-01', hoursWorked: 10, spreadOverHours: 12 }];
      const result = validateSEWorkingHours('Delhi', entries);

      expect(result.violations.length).toBeGreaterThan(0);
      for (const v of result.violations) {
        expect(typeof v.issue).toBe('string');
        expect(v.limit).toBeDefined();
        expect(v.actual).toBeDefined();
      }
    });

    it('daily violations carry the date field', () => {
      const entries: TimesheetEntry[] = [{ date: '2026-03-05', hoursWorked: 11, spreadOverHours: 10 }];
      const result = validateSEWorkingHours('Maharashtra', entries);

      const dailyViolation = result.violations.find(v => v.date);
      expect(dailyViolation?.date).toBe('2026-03-05');
    });
  });

});
