import { describe, it, expect } from 'vitest';
import { validateSEWorkingHours } from './seCompliance';
import { TimesheetEntry } from './oshCompliance';

describe('S&E Compliance - Working Hours', () => {
  it('should validate compliant shifts in Maharashtra', () => {
    const entries: TimesheetEntry[] = [
      { date: '2026-03-01', hoursWorked: 9, spreadOverHours: 10 },
      { date: '2026-03-02', hoursWorked: 9, spreadOverHours: 10.5 },
      { date: '2026-03-03', hoursWorked: 8, spreadOverHours: 9 },
    ];
    
    // Total 26 hours, well below 48 weekly. Max daily is 9. Max spread is 10.5.
    const result = validateSEWorkingHours('Maharashtra', entries);
    
    expect(result.stateRuleApplied).toBe('Maharashtra');
    expect(result.isCompliant).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should flag excessive daily hours in Delhi', () => {
    const entries: TimesheetEntry[] = [
      { date: '2026-03-01', hoursWorked: 10, spreadOverHours: 11 }, // Max daily 9, max spread 10.5
    ];
    
    const result = validateSEWorkingHours('Delhi', entries);
    
    expect(result.isCompliant).toBe(false);
    expect(result.violations).toHaveLength(2); // Both daily hours and spread-over exceeded
    expect(result.violations[0].issue).toContain('Daily working hours');
    expect(result.violations[1].issue).toContain('Daily spread-over');
  });

  it('should return warnings if state rule not found', () => {
    const entries: TimesheetEntry[] = [
      { date: '2026-03-01', hoursWorked: 10, spreadOverHours: 11 },
    ];
    
    const result = validateSEWorkingHours('Goa', entries);
    
    expect(result.isCompliant).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('No specific S&E working hours config found');
  });
});
