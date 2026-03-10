import { describe, it, expect } from 'vitest';
import {
  calculateBonus,
  calculateGratuity,
  estimateMaternityBenefitTotal,
  calculateEPF,
  defineWages,
} from './calculations';
import { calculateAggregatorCess } from './socialSecurity/gigCess';
import { BONUS_RULES } from './config/wage/bonusRules';
import { GRATUITY_RULES } from './config/socialSecurity/gratuityRules';

// ─── Bonus ───────────────────────────────────────────────────────────────────

describe('Social Security Compliance Engine', () => {
  describe('Bonus (Payment of Bonus Act / Code on Wages)', () => {
    it('should be ineligible if worked < 30 days', () => {
      const result = calculateBonus(15000, 15000, 1, 20, 8.33);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Minimum 30 working days required');
    });

    it('should be ineligible if wages exceed eligibility ceiling (> ₹21,000)', () => {
      const result = calculateBonus(25000, 15000, 12, 300, 8.33);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Wages exceed eligibility ceiling');
    });

    it('should cap calculation wage at max(₹7000, minWage)', () => {
      // Basic 18k, MinWage 13k → cap = 13k per month × 10 months = 1.3L × 8.33% ≈ 10,829
      const result = calculateBonus(18000, 13000, 10, 250, 8.33);
      expect(result.isEligible).toBe(true);
      expect(result.bonusWages).toBe(13000 * 10);
      expect(result.bonusAmount).toBe(Math.round(130000 * 0.0833));
    });

    it('should clamp bonus percent to minimum 8.33%', () => {
      const result = calculateBonus(15000, 10000, 12, 300, 5); // 5% below min, should clamp to 8.33%
      expect(result.isEligible).toBe(true);
      expect(result.bonusPercent).toBeGreaterThanOrEqual(BONUS_RULES.minPercentage);
    });

    it('should clamp bonus percent to maximum 20%', () => {
      const result = calculateBonus(15000, 10000, 12, 300, 25); // 25% above max
      expect(result.bonusPercent).toBeLessThanOrEqual(BONUS_RULES.maxPercentage);
    });
  });

  // ─── Gratuity ───────────────────────────────────────────────────────────

  describe('Gratuity (Code on Social Security, 2020)', () => {
    it('should be ineligible when < 5 years and not fixed-term', () => {
      const result = calculateGratuity('2020-01-01', '2022-01-01', 20000, false, 'Permanent');
      expect(result.isEligible).toBe(false);
    });

    it('should be eligible after 5+ years for permanent employee', () => {
      const result = calculateGratuity('2018-01-01', '2024-01-01', 30000, false, 'Permanent');
      expect(result.isEligible).toBe(true);
      expect(result.yearsOfService).toBeGreaterThanOrEqual(5);
    });

    it('should be eligible after ≥ 1 year for fixed-term employee', () => {
      const result = calculateGratuity('2020-01-01', '2022-01-01', 20000, false, 'Fixed-Term');
      expect(result.isEligible).toBe(true);
      expect(result.yearsOfService).toBe(2);
      expect(result.gratuityAmount).toBe(Math.round(20000 * (15 / 26) * 2));
    });

    it('should waive 5-year rule for death or disability', () => {
      const result = calculateGratuity('2023-01-01', '2024-01-01', 25000, true, 'Permanent');
      expect(result.isEligible).toBe(true);
    });

    it('should cap gratuity at ₹20 Lakhs', () => {
      // 34 yrs × 150000 × 15/26 ≈ ₹29.4L → capped at ₹20L
      const result = calculateGratuity('1990-01-01', '2024-01-01', 150000, false, 'Permanent');
      expect(result.isEligible).toBe(true);
      expect(result.wasCapped).toBe(true);
      expect(result.gratuityAmount).toBe(2000000);
    });

    it('should round up service years when remaining months ≥ 6', () => {
      // Join Jan 2018, leave Sep 2023 → 5 yrs 8 months → rounds up to 6 years
      const result = calculateGratuity('2018-01-01', '2023-09-01', 30000, false, 'Permanent');
      expect(result.isEligible).toBe(true);
      expect(result.yearsOfService).toBe(6);
    });

    it('citation should reference Code on Social Security', () => {
      const result = calculateGratuity('2018-01-01', '2024-01-01', 30000, false, 'Permanent');
      // Gratuity citation uses actName (combined act name), not codeName
      expect(result.citation.actName.toLowerCase()).toContain('social security');
    });
  });

  // ─── Maternity ───────────────────────────────────────────────────────────

  describe('Maternity Benefit (Maternity Benefit Act / Code on Social Security)', () => {
    it('should correctly estimate 26-week benefit with medical bonus', () => {
      // 500/day × 6 days × 26 weeks = 78,000 + 3,500 medical bonus = 81,500
      const result = estimateMaternityBenefitTotal(500, 26, true);
      expect(result.estimatedWages).toBe(78000);
      expect(result.medicalBonus).toBe(3500);
      expect(result.totalBenefit).toBe(81500);
    });

    it('should exclude medical bonus when employer provides prenatal care', () => {
      const result = estimateMaternityBenefitTotal(500, 26, false);
      expect(result.medicalBonus).toBe(0);
      expect(result.totalBenefit).toBe(result.estimatedWages);
    });

    it('should cap benefit weeks at 26 (max for 1st/2nd child)', () => {
      const result = estimateMaternityBenefitTotal(500, 30, true); // 30 > 26 cap
      expect(result.validWeeks).toBe(26);
    });
  });

  // ─── EPF ────────────────────────────────────────────────────────────────

  describe('EPF (Employees\' Provident Fund, Code on Social Security)', () => {
    it('should calculate 12% employee + 3.67%+8.33% employer split for basic ≤ ₹15,000', () => {
      const result = calculateEPF(15000);
      expect(result.applicable).toBe(true);
      expect(result.employeeEPF).toBe(Math.round(15000 * 0.12));       // 1800
      expect(result.employerEPF).toBe(Math.round(15000 * 0.0367));     // 550
      expect(result.employerEPS).toBe(Math.round(15000 * 0.0833));     // 1250
    });

    it('should cap EPS wages at ₹15,000 even when basic is higher', () => {
      const result = calculateEPF(25000);
      expect(result.applicable).toBe(true);
      // Employee EPF is on full basic (25,000 × 12%)
      expect(result.employeeEPF).toBe(Math.round(25000 * 0.12)); // 3000
      // Employer EPS is capped at 15,000
      expect(result.epsWages).toBe(15000);
      expect(result.employerEPS).toBe(Math.round(15000 * 0.0833)); // 1250
    });

    it('should not be applicable for gig/platform workers', () => {
      const result = calculateEPF(25000, 'gig');
      expect(result.applicable).toBe(false);
      expect(result.employeeEPF).toBe(0);
    });
  });

  // ─── Wage Definition (50% rule) ──────────────────────────────────────────

  describe('defineWages — Code on Wages 2019 (50% rule)', () => {
    it('should be compliant when allowances ≤ 50% of total remuneration', () => {
      // Basic 30k, Allowances 20k → total 50k. Allowances = 40% < 50% → compliant
      const result = defineWages({ basic: 30000, da: 0, retainingAllowance: 0, allowances: 20000 });
      expect(result.isCompliant).toBe(true);
      expect(result.wages).toBe(30000);
      expect(result.addedBackToWages).toBe(0);
    });

    it('should add back excess allowances to wages when allowances > 50%', () => {
      // Basic 20k, Allowances 40k → total 60k. Allowances = 67% > 50%
      // maxExclusions = 30k. Excess = 40k - 30k = 10k added back
      const result = defineWages({ basic: 20000, da: 0, retainingAllowance: 0, allowances: 40000 });
      expect(result.isCompliant).toBe(false);
      expect(result.addedBackToWages).toBe(10000);
      expect(result.wages).toBe(30000); // 20000 + 10000
    });

    it('should handle zero total remuneration gracefully', () => {
      const result = defineWages({ basic: 0, da: 0, retainingAllowance: 0, allowances: 0 });
      expect(result.wages).toBe(0);
      expect(result.isCompliant).toBe(true);
    });

    it('should include DA in base wages calculation', () => {
      // Basic 15k + DA 5k = 20k wages, Allowances 10k → total 30k. Allowances = 33% < 50%
      const result = defineWages({ basic: 15000, da: 5000, retainingAllowance: 0, allowances: 10000 });
      expect(result.isCompliant).toBe(true);
      expect(result.wages).toBe(20000);
    });
  });

  // ─── Gig & Platform Worker Cess ──────────────────────────────────────────

  describe('Gig / Platform Worker Aggregator Cess (Code on Social Security, Ch. IX, Section 114)', () => {
    it('should use turnover cess when it is smaller than the gig-worker cap', () => {
      // Turnover 10Cr × 1% = 10L cess
      // Gig payments 500Cr × 5% = 25Cr cap
      // min(10L, 25Cr) = 10L
      const result = calculateAggregatorCess({
        companyId: 'CMP1',
        financialYear: '2025-26',
        annualTurnover: 100_000_000,   // ₹10 Cr
        amountPayableToGigWorkers: 5_000_000_000, // ₹500 Cr
      });

      expect(result.turnoverCess).toBe(100_000_000 * 0.01);    // 10L
      expect(result.gigWorkerCap).toBe(5_000_000_000 * 0.05); // 25Cr
      expect(result.estimatedContribution).toBe(result.turnoverCess);
    });

    it('should use gig-worker cap when turnover cess is larger', () => {
      // Turnover 1000Cr × 1% = 10Cr cess
      // Gig payments 10Cr × 5% = 50L cap
      // min(10Cr, 50L) = 50L (the cap wins)
      const result = calculateAggregatorCess({
        companyId: 'CMP2',
        financialYear: '2025-26',
        annualTurnover: 10_000_000_000,   // ₹1000 Cr
        amountPayableToGigWorkers: 100_000_000, // ₹10 Cr
      });

      expect(result.turnoverCess).toBe(10_000_000_000 * 0.01);   // 100Cr
      expect(result.gigWorkerCap).toBe(100_000_000 * 0.05);      // 50L
      expect(result.estimatedContribution).toBe(result.gigWorkerCap);
    });

    it('should mark result as compliant', () => {
      const result = calculateAggregatorCess({
        companyId: 'CMP3',
        financialYear: '2025-26',
        annualTurnover: 50_000_000,
        amountPayableToGigWorkers: 5_000_000,
      });

      expect(result.isCompliant).toBe(true);
    });

    it('citation should reference Code on Social Security Section 114', () => {
      const result = calculateAggregatorCess({
        companyId: 'CMP4',
        financialYear: '2025-26',
        annualTurnover: 50_000_000,
        amountPayableToGigWorkers: 5_000_000,
      });

      expect(result.citation.sectionOrRule).toContain('114');
      expect(result.citation.codeName).toContain('Social Security');
    });

    it('should produce zero cess for zero turnover', () => {
      const result = calculateAggregatorCess({
        companyId: 'CMP5',
        financialYear: '2025-26',
        annualTurnover: 0,
        amountPayableToGigWorkers: 0,
      });

      expect(result.estimatedContribution).toBe(0);
    });
  });

});
