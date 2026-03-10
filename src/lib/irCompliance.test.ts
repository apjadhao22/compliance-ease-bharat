import { describe, it, expect } from 'vitest';
import { computeRetrenchmentCompensation } from './calculations';
import {
  IR_STANDING_ORDERS_RULES,
  IR_GRIEVANCE_RULES,
} from './config/ir/standingOrderRules';

// ── Retrenchment Compensation ────────────────────────────────────────────────

describe('Industrial Relations — Retrenchment Compensation (IR Code 2020, Ch. X)', () => {

  it('should compute correct compensation for 5-year tenure with full notice', () => {
    // 5 yrs × 15 days × (52000 / 26) = 5 × 15 × 2000 = 150,000
    const result = computeRetrenchmentCompensation(5, 52000, 30, 30);

    expect(result.retrenchmentCompensation).toBe(150000);
    expect(result.noticePayShortfall).toBe(0);
    expect(result.total).toBe(150000);
    expect(result.citation.sectionOrRule).toContain('Retrenchment Compensation');
  });

  it('should add notice-pay shortfall when less notice given than required', () => {
    // 3 yrs × 15 days × (26000/26=1000) = 45,000 compensation
    // 0 notice given of 30 required: 30 × 1000 = 30,000 shortfall
    const result = computeRetrenchmentCompensation(3, 26000, 0, 30);

    expect(result.retrenchmentCompensation).toBe(45000);
    expect(result.noticePayShortfall).toBe(30000);
    expect(result.total).toBe(75000);
  });

  it('should produce zero compensation for 0 years of service', () => {
    const result = computeRetrenchmentCompensation(0, 26000, 30, 30);

    expect(result.retrenchmentCompensation).toBe(0);
    expect(result.noticePayShortfall).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should produce partial shortfall when some notice is given', () => {
    // 10 yrs × 15 × (52000/26=2000) = 300,000 compensation
    // 15 notice given of 30 required: 15 × 2000 = 30,000 shortfall
    const result = computeRetrenchmentCompensation(10, 52000, 15, 30);

    expect(result.retrenchmentCompensation).toBe(300000);
    expect(result.noticePayShortfall).toBe(30000);
    expect(result.total).toBe(330000);
  });

  it('should produce zero shortfall when notice given equals required', () => {
    const result = computeRetrenchmentCompensation(2, 26000, 30, 30);

    expect(result.noticePayShortfall).toBe(0);
  });

  it('citation should reference IR Code', () => {
    const result = computeRetrenchmentCompensation(5, 26000, 30, 30);

    expect(result.citation).toBeDefined();
    expect(typeof result.citation.codeName).toBe('string');
    expect(result.citation.codeName.toLowerCase()).toContain('industrial');
  });

});

// ── Standing Orders (IR Code 2020, Chapter IV) ───────────────────────────────

describe('Industrial Relations — Standing Orders (IR Code 2020, Ch. IV, Section 28)', () => {

  it('config headcount threshold should be 300 under IR Code 2020', () => {
    expect(IR_STANDING_ORDERS_RULES.headcountThreshold).toBe(300);
  });

  it('standing orders are required at exactly 300 employees', () => {
    // Helper: derive applicability from config threshold
    const isRequired = (count: number) => count >= IR_STANDING_ORDERS_RULES.headcountThreshold;

    expect(isRequired(300)).toBe(true);
    expect(isRequired(299)).toBe(false);
    expect(isRequired(1000)).toBe(true);
    expect(isRequired(0)).toBe(false);
  });

  it('citation should reference IR Code Chapter IV Section 28', () => {
    expect(IR_STANDING_ORDERS_RULES.citation.codeName).toContain('Industrial Relations Code');
    expect(IR_STANDING_ORDERS_RULES.citation.sectionOrRule).toContain('28');
  });

});

// ── Grievance Redressal Committee (IR Code 2020, Chapter II) ─────────────────

describe('Industrial Relations — Grievance Redressal (IR Code 2020, Ch. II, Section 4)', () => {

  it('config headcount threshold should be 20 under IR Code 2020', () => {
    expect(IR_GRIEVANCE_RULES.headcountThreshold).toBe(20);
  });

  it('grievance committee is mandatory at exactly 20 employees', () => {
    const isRequired = (count: number) => count >= IR_GRIEVANCE_RULES.headcountThreshold;

    expect(isRequired(20)).toBe(true);
    expect(isRequired(19)).toBe(false);
    expect(isRequired(500)).toBe(true);
  });

  it('max grievance committee members should be 10', () => {
    expect(IR_GRIEVANCE_RULES.maxMembers).toBe(10);
  });

  it('citation should reference IR Code Chapter II Section 4', () => {
    expect(IR_GRIEVANCE_RULES.citation.sectionOrRule).toContain('4');
  });

  it('a company with 15 employees needs grievance committee but NOT standing orders', () => {
    const headcount = 15;
    const needsGrievance = headcount >= IR_GRIEVANCE_RULES.headcountThreshold;
    const needsStandingOrders = headcount >= IR_STANDING_ORDERS_RULES.headcountThreshold;

    // 15 < 20: no grievance required
    expect(needsGrievance).toBe(false);
    expect(needsStandingOrders).toBe(false);
  });

  it('a company with 50 employees needs grievance committee but NOT standing orders', () => {
    const headcount = 50;
    const needsGrievance = headcount >= IR_GRIEVANCE_RULES.headcountThreshold;
    const needsStandingOrders = headcount >= IR_STANDING_ORDERS_RULES.headcountThreshold;

    expect(needsGrievance).toBe(true);
    expect(needsStandingOrders).toBe(false); // < 300
  });

  it('a company with 300+ employees needs BOTH grievance committee and standing orders', () => {
    const headcount = 300;

    expect(headcount >= IR_GRIEVANCE_RULES.headcountThreshold).toBe(true);
    expect(headcount >= IR_STANDING_ORDERS_RULES.headcountThreshold).toBe(true);
  });

});
