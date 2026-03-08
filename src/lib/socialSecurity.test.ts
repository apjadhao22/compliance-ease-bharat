import { describe, it, expect } from 'vitest';
import { calculateBonus, calculateGratuity, calculateMaternityBenefit, estimateMaternityBenefitTotal } from './calculations';
import { BONUS_RULES } from './config/wage/bonusRules';
import { GRATUITY_RULES } from './config/socialSecurity/gratuityRules';

describe('Social Security Compliance Engine', () => {
  describe('Bonus (Payment of Bonus Act / Wage Code)', () => {
    it('Should be ineligible if worked < 30 days', () => {
      const result = calculateBonus(15000, 15000, 1, 20, 8.33);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Minimum 30 working days required');
    });

    it('Should be ineligible if wages exceed eligibility ceiling', () => {
      const result = calculateBonus(25000, 15000, 12, 300, 8.33); // basicDA > 21k
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Wages exceed eligibility ceiling');
    });

    it('Should cap calculations at max(7000, minWage)', () => {
      // Basic 18k, MinWage 13k. Calculation should be based on 13k over 10 months -> 130k base -> 8.33% = 10,829
      const result = calculateBonus(18000, 13000, 10, 250, 8.33);
      expect(result.isEligible).toBe(true);
      expect(result.bonusWages).toBe(13000 * 10);
      expect(result.bonusAmount).toBe(Math.round(130000 * 0.0833));
    });
  });

  describe('Gratuity (Code on Social Security)', () => {
    it('Should decline if < 5 years and not fixed-term', () => {
      const joinDate = '2020-01-01';
      const leaveDate = '2022-01-01'; // 2 years
      const result = calculateGratuity(joinDate, leaveDate, 20000, false, "Permanent");
      expect(result.isEligible).toBe(false);
    });

    it('Should accept > 1 year if Fixed-Term', () => {
      const joinDate = '2020-01-01';
      const leaveDate = '2022-01-01'; // 2 years
      const result = calculateGratuity(joinDate, leaveDate, 20000, false, "Fixed-Term");
      expect(result.isEligible).toBe(true);
      expect(result.yearsOfService).toBe(2);
      expect(result.gratuityAmount).toBe(Math.round(20000 * (15/26) * 2));
    });

    it('Should cap at ₹20 Lakhs limit', () => {
      const joinDate = '1990-01-01';
      const leaveDate = '2024-01-01'; // 34 years
      // 34 * 15/26 * 100000 = ~1.96M (close). Let's use 150000 -> 2.94M
      const result = calculateGratuity(joinDate, leaveDate, 150000, false, "Permanent");
      expect(result.isEligible).toBe(true);
      expect(result.wasCapped).toBe(true);
      expect(result.gratuityAmount).toBe(2000000);
    });
  });

  describe('Maternity Benefit', () => {
    it('Should correctly estimate benefit based on 26 weeks', () => {
      const dailyWage = 500;
      // 500 * 6 days * 26 weeks = 78000
      const result = estimateMaternityBenefitTotal(dailyWage, 26, true);
      expect(result.estimatedWages).toBe(78000);
      expect(result.medicalBonus).toBe(3500);
      expect(result.totalBenefit).toBe(81500);
    });
  });
});
