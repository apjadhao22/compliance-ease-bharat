import { describe, it, expect } from 'vitest';
import { validateWages } from './wageValidation';
import { NATIONAL_FLOOR_WAGE } from './config/wage/floorWage';

describe('Wage Validation Logic', () => {

  // ── Maharashtra ──────────────────────────────────────────────────────────

  it('should be compliant when wages are above both floor and state minimum (MH Skilled)', () => {
    const result = validateWages({
      employeeId: 'EMP001',
      state: 'Maharashtra',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Skilled',
      zone: 'Zone I',
      actualMonthlyWages: 20000 // above 15296
    });

    expect(result.isCompliant).toBe(true);
    expect(result.status).toBe('Compliant');
    expect(result.violations.length).toBe(0);
    expect(result.statutoryMinimumWage).toBe(15296);
  });

  it('should be non-compliant when wages are below national floor wage', () => {
    const floor = NATIONAL_FLOOR_WAGE.amount;
    const result = validateWages({
      employeeId: 'EMP002',
      state: 'Maharashtra',
      skillLevel: 'Unskilled',
      actualMonthlyWages: floor - 1000 // below floor
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.violations.some(v => v.issue.includes('Floor Wage'))).toBe(true);
  });

  it('should be non-compliant when above floor but below state minimum (MH Highly Skilled)', () => {
    const floor = NATIONAL_FLOOR_WAGE.amount;
    const result = validateWages({
      employeeId: 'EMP003',
      state: 'Maharashtra',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Highly Skilled',
      zone: 'Zone I',
      actualMonthlyWages: 16000 // above floor, below 17056
    });

    expect(16000).toBeGreaterThan(floor);
    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.violations.some(v => v.issue.includes('State Minimum Wage'))).toBe(true);
    expect(result.statutoryMinimumWage).toBe(17056);
  });

  // ── Unknown state ────────────────────────────────────────────────────────

  it('should return Unknown status when state/category is not configured', () => {
    const result = validateWages({
      employeeId: 'EMP004',
      state: 'Punjab',
      skillLevel: 'Skilled',
      actualMonthlyWages: 20000
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Unknown - State/Category Not Configured');
    expect(result.violations[0].issue).toContain('Manual verification');
  });

  // ── Karnataka ────────────────────────────────────────────────────────────

  it('should detect Karnataka Unskilled below state minimum (₹14,000)', () => {
    const result = validateWages({
      employeeId: 'EMP005',
      state: 'Karnataka',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Unskilled',
      zone: 'Zone I',
      actualMonthlyWages: 13000 // below 14000
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.stateMinimumWage).toBe(14000);
    expect(result.violations.some(v => v.shortfall === 1000)).toBe(true);
  });

  // ── Delhi ────────────────────────────────────────────────────────────────

  it('should be compliant for Delhi Skilled above minimum (₹21,215)', () => {
    const result = validateWages({
      employeeId: 'EMP006',
      state: 'Delhi',
      category: 'All',
      skillLevel: 'Skilled',
      zone: 'All',
      actualMonthlyWages: 25000 // above 21215
    });

    expect(result.isCompliant).toBe(true);
    expect(result.status).toBe('Compliant');
    expect(result.stateMinimumWage).toBe(21215);
  });

  // ── Tamil Nadu ───────────────────────────────────────────────────────────

  it('should detect TamilNadu Semi-Skilled below state minimum (₹12,000)', () => {
    const result = validateWages({
      employeeId: 'EMP007',
      state: 'TamilNadu',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Semi-Skilled',
      zone: 'Zone A',
      actualMonthlyWages: 11500 // below 12000
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.stateMinimumWage).toBe(12000);
  });

  // ── Telangana (newly added) ───────────────────────────────────────────────

  it('should detect Telangana Unskilled below minimum (₹13,000)', () => {
    const result = validateWages({
      employeeId: 'EMP_TS001',
      state: 'Telangana',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Unskilled',
      zone: 'All',
      actualMonthlyWages: 12000 // below 13000
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('Non-Compliant');
    expect(result.stateMinimumWage).toBe(13000);
    expect(result.violations.some(v => v.shortfall === 1000)).toBe(true);
  });

  it('should be compliant for Telangana Semi-Skilled at ₹14,500 (minimum is ₹14,000)', () => {
    const result = validateWages({
      employeeId: 'EMP_TS002',
      state: 'Telangana',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Semi-Skilled',
      zone: 'All',
      actualMonthlyWages: 14500 // above 14000
    });

    expect(result.isCompliant).toBe(true);
    expect(result.stateMinimumWage).toBe(14000);
  });

  it('should detect Telangana Skilled exactly at minimum ₹15,500 — compliant', () => {
    const result = validateWages({
      employeeId: 'EMP_TS003',
      state: 'Telangana',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Skilled',
      zone: 'All',
      actualMonthlyWages: 15500 // exactly at minimum
    });

    expect(result.isCompliant).toBe(true);
    expect(result.stateMinimumWage).toBe(15500);
  });

  it('should detect Telangana Highly Skilled below minimum ₹17,000', () => {
    const result = validateWages({
      employeeId: 'EMP_TS004',
      state: 'Telangana',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Highly Skilled',
      zone: 'All',
      actualMonthlyWages: 16000 // below 17000
    });

    expect(result.isCompliant).toBe(false);
    expect(result.stateMinimumWage).toBe(17000);
    expect(result.violations.some(v => v.shortfall === 1000)).toBe(true);
  });

  it('should be compliant for Telangana Highly Skilled above ₹17,000', () => {
    const result = validateWages({
      employeeId: 'EMP_TS005',
      state: 'Telangana',
      category: 'Shops and Commercial Establishments',
      skillLevel: 'Highly Skilled',
      zone: 'All',
      actualMonthlyWages: 18000 // above 17000
    });

    expect(result.isCompliant).toBe(true);
  });

});
