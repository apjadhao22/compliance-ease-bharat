import { describe, it, expect } from 'vitest';
import { validateWagePayment } from './wageCompliance';

describe('Wage Compliance Validation', () => {
  it('should validate compliant wage deductions', () => {
    // 50,000 gross. Total deductions 15,000 (30%). Fine 500 (1%).
    const res = validateWagePayment('monthly', 50000, 15000, 500, false);
    expect(res.isCompliant).toBe(true);
    expect(res.deductionWarning).toBeNull();
    expect(res.prohibitedDeductionWarning).toBeNull();
    expect(res.deadlineWarning).toContain('seventh day');
  });

  it('should reject deductions over 50%', () => {
    // 50,000 gross. Total deductions 30,000 (60%).
    const res = validateWagePayment('monthly', 50000, 30000, 0, false);
    expect(res.isCompliant).toBe(false);
    expect(res.deductionWarning).toContain('exceed the statutory limit of 50%');
  });

  it('should reject fines over 3%', () => {
    // 50,000 gross. Total deductions 5000 (10%). Fine 2500 (5%).
    const res = validateWagePayment('monthly', 50000, 5000, 2500, false);
    expect(res.isCompliant).toBe(false);
    expect(res.prohibitedDeductionWarning).toContain('exceed the statutory limit of 3%');
  });

  it('should allow deductions over 50% for cooperative societies (up to 75%)', () => {
    // 50,000 gross. Total deductions 30,000 (60%). Cooperative = true.
    const res = validateWagePayment('monthly', 50000, 30000, 0, true);
    expect(res.isCompliant).toBe(true);
    expect(res.deductionWarning).toBeNull();
  });

  it('should treat deductions at exactly 50% as compliant', () => {
    // 40,000 gross. Total deductions 20,000 (exactly 50%).
    const res = validateWagePayment('monthly', 40000, 20000, 0, false);
    expect(res.isCompliant).toBe(true);
    expect(res.deductionWarning).toBeNull();
  });

  it('should reject cooperative society deductions above 75%', () => {
    // 40,000 gross. Total deductions 32,000 (80%). Cooperative = true.
    const res = validateWagePayment('monthly', 40000, 32000, 0, true);
    expect(res.isCompliant).toBe(false);
    expect(res.deductionWarning).toContain('exceed the statutory limit of 75%');
  });

  it('should flag F&F where notice recovery + loans exceed 50% of earnings', () => {
    // F&F: earnings 60,000 (gratuity + leave). Deductions 35,000 (58.3%).
    const res = validateWagePayment('monthly', 60000, 35000, 0, false);
    expect(res.isCompliant).toBe(false);
    expect(res.deductionWarning).toContain('exceed the statutory limit of 50%');
  });
});
