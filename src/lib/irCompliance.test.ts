import { describe, it, expect } from 'vitest';
import { calculateRetrenchmentCompensation } from './calculations';

describe('IR Code - Retrenchment Compensation', () => {
  it('should calculate 15 days pay per year of service exactly', () => {
    // 5 years, exactly. 15 * 1000 * 5 = 75,000
    const result = calculateRetrenchmentCompensation(1000, 5, 0);
    expect(result.effectiveYears).toBe(5);
    expect(result.compensation).toBe(75000);
  });

  it('should round up years if remaining months > 6', () => {
    // 5 years, 8 months -> effective 6 years. 15 * 1000 * 6 = 90,000
    const result = calculateRetrenchmentCompensation(1000, 5, 8);
    expect(result.effectiveYears).toBe(6);
    expect(result.compensation).toBe(90000);
  });

  it('should ignore remaining months <= 6', () => {
    // 5 years, 4 months -> effective 5 years. 15 * 1000 * 5 = 75,000
    const result = calculateRetrenchmentCompensation(1000, 5, 4);
    expect(result.effectiveYears).toBe(5);
    expect(result.compensation).toBe(75000);
  });

  it('should include citation', () => {
    const result = calculateRetrenchmentCompensation(1000, 5, 4);
    expect(result.citation?.codeName).toContain('Industrial Relations Code');
  });
});
