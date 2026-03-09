import { describe, it, expect } from 'vitest';
import { validateWages } from './wageValidation';
import { NATIONAL_FLOOR_WAGE } from './config/wage/floorWage';

describe('Wage Validation Logic', () => {
  it('should be compliant when wages are above both floor and state minimum', () => {
    const result = validateWages({
      employeeId: 'EMP001',
      state: 'Maharashtra',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Skilled',
      zone: 'Zone I',
      actualMonthlyWages: 20000 // Above 15296
    });

    expect(result.isCompliant).toBe(true);
    expect(result.status).toBe('Compliant');
    expect(result.violations.length).toBe(0);
    expect(result.statutoryMinimumWage).toBe(15296);
  });

  it('should be non-compliant when wages are below national floor wage', () => {
    // Even if state minimum isn't found, being below floor wage is non-compliant
    const floor = NATIONAL_FLOOR_WAGE.amount;
    const result = validateWages({
      employeeId: 'EMP002',
      state: 'Maharashtra',
      skillLevel: 'Unskilled',
      actualMonthlyWages: floor - 1000 // Below floor
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.violations.some(v => v.issue.includes('Floor Wage'))).toBe(true);
  });

  it('should be non-compliant when wages are above floor but below state minimum', () => {
    const floor = NATIONAL_FLOOR_WAGE.amount;
    const result = validateWages({
      employeeId: 'EMP003',
      state: 'Maharashtra',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Highly Skilled',
      zone: 'Zone I',
      actualMonthlyWages: 16000 // Above floor, below 17056
    });

    expect(16000).toBeGreaterThan(floor);
    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.violations.some(v => v.issue.includes('State Minimum Wage'))).toBe(true);
    expect(result.statutoryMinimumWage).toBe(17056);
  });

  it('should return Unknown status when state/category is not configured', () => {
    const result = validateWages({
      employeeId: 'EMP004',
      state: 'Punjab', // Not configured yet
      skillLevel: 'Skilled',
      actualMonthlyWages: 20000 // Safe high amount
    });

    expect(result.isCompliant).toBe(false); // Can't guarantee compliance
    expect(result.status).toBe('Unknown - State/Category Not Configured');
    expect(result.violations[0].issue).toContain('Manual verification');
  });

  it('should detect Karnataka Unskilled below state minimum', () => {
    const result = validateWages({
      employeeId: 'EMP005',
      state: 'Karnataka',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Unskilled',
      zone: 'Zone I',
      actualMonthlyWages: 13000 // Below 14000
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.stateMinimumWage).toBe(14000);
    expect(result.violations.some(v => v.shortfall === 1000)).toBe(true);
  });

  it('should be compliant for Delhi Skilled above minimum', () => {
    const result = validateWages({
      employeeId: 'EMP006',
      state: 'Delhi',
      category: 'All',
      skillLevel: 'Skilled',
      zone: 'All',
      actualMonthlyWages: 25000 // Above 21215
    });

    expect(result.isCompliant).toBe(true);
    expect(result.status).toBe('Compliant');
    expect(result.stateMinimumWage).toBe(21215);
  });

  it('should detect TamilNadu Semi-Skilled below state minimum', () => {
    const result = validateWages({
      employeeId: 'EMP007',
      state: 'TamilNadu',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Semi-Skilled',
      zone: 'Zone A',
      actualMonthlyWages: 11500 // Below 12000
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.stateMinimumWage).toBe(12000);
  });
});
