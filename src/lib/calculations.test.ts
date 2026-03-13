import { describe, it, expect } from 'vitest';
import { calculatePT, calculateLWF } from '../../src/lib/calculations';

describe('Professional Tax Calculations', () => {
    describe('Maharashtra Rules', () => {
        it('calculates PT for Males in MH correctly', () => {
            // Male below 7500
            expect(calculatePT(7000, 'Maharashtra', { gender: 'male' })).toBe(0);
            // Male 7501 to 10000
            expect(calculatePT(9000, 'Maharashtra', { gender: 'male' })).toBe(175);
            // Male above 10000
            expect(calculatePT(15000, 'Maharashtra', { gender: 'male' })).toBe(200);
        });

        it('calculates PT for Females in MH correctly', () => {
            // Female below 25000
            expect(calculatePT(20000, 'Maharashtra', { gender: 'female' })).toBe(0);
            // Female above 25000
            expect(calculatePT(30000, 'Maharashtra', { gender: 'female' })).toBe(200);
        });

        it('applies February/March special override for MH', () => {
            // Male above 10k gets 300 in Feb
            expect(calculatePT(15000, 'Maharashtra', { gender: 'male', isFebruary: true })).toBe(300);
            // Female below 25k gets 0 in Feb
            expect(calculatePT(20000, 'Maharashtra', { gender: 'female', isFebruary: true })).toBe(0);
            // Female above 25k gets 300 in Feb
            expect(calculatePT(30000, 'Maharashtra', { gender: 'female', isFebruary: true })).toBe(300);
        });
    });

    describe('Karnataka Rules', () => {
        it('calculates standard PT for KA correctly', () => {
            // Below 25000
            expect(calculatePT(24000, 'Karnataka')).toBe(0);
            // Above 25000
            expect(calculatePT(30000, 'Karnataka')).toBe(200);
        });

        it('applies February special override for KA', () => {
            // Above 25k gets 300 in Feb
            expect(calculatePT(30000, 'Karnataka', { isFebruary: true })).toBe(300);
        });
    });

    describe('Annual & Cap Rules (Madhya Pradesh)', () => {
        it('calculates MP annual PT correctly', () => {
            // Below 2.25L
            expect(calculatePT(0, 'MadhyaPradesh', { annualSalary: 200000 })).toBe(0);
            // 2.25L to 3L
            expect(calculatePT(0, 'MadhyaPradesh', { annualSalary: 250000 })).toBe(1500);
            // 3L to 4L
            expect(calculatePT(0, 'MadhyaPradesh', { annualSalary: 350000 })).toBe(2000);
            // Above 4L -> max 2500
            expect(calculatePT(0, 'MadhyaPradesh', { annualSalary: 500000 })).toBe(2500);
        });
    });

    describe('Non-Applicable States', () => {
        it('returns 0 for Delhi, UP, etc.', () => {
            expect(calculatePT(50000, 'Delhi')).toBe(0);
            expect(calculatePT(50000, 'UttarPradesh')).toBe(0);
        });
    });
});


describe('Labour Welfare Fund Calculations', () => {
    describe('Maharashtra LWF', () => {
        it('calculates correct amounts during applicable months', () => {
            // Applicable in June (06)
            const juneRes = calculateLWF('2026-06', 'Maharashtra', 50000, true);
            expect(juneRes.employeeContribution).toBe(25);
            expect(juneRes.employerContribution).toBe(75);
            expect(juneRes.applicableMonth).toBe(true);

            // Applicable in December (12)
            const decRes = calculateLWF('2026-12', 'Maharashtra', 50000, true);
            expect(decRes.employeeContribution).toBe(25);
            expect(decRes.employerContribution).toBe(75);
            expect(decRes.applicableMonth).toBe(true);
        });

        it('returns zero for non-applicable months', () => {
            // Not applicable in July
            const julyRes = calculateLWF('2026-07', 'Maharashtra', 50000, true);
            expect(julyRes.employeeContribution).toBe(0);
            expect(julyRes.applicableMonth).toBe(false);
        });
    });

    describe('Tamil Nadu LWF (Slab-based)', () => {
        it('calculates correctly based on gross slabs', () => {
            // Gross <= 5000
            const low = calculateLWF('2026-06', 'TamilNadu', 4500, true);
            expect(low.employeeContribution).toBe(25);
            expect(low.employerContribution).toBe(50);

            // Gross 5000 to 10000
            const mid = calculateLWF('2026-06', 'TamilNadu', 8000, true);
            expect(mid.employeeContribution).toBe(50);
            expect(mid.employerContribution).toBe(100);

            // Gross > 10000
            const high = calculateLWF('2026-06', 'TamilNadu', 25000, true);
            expect(high.employeeContribution).toBe(75);
            expect(high.employerContribution).toBe(150);
        });
    });

    describe('Non-Applicable States', () => {
        it('returns zero for non-LWF states', () => {
            const upRes = calculateLWF('2026-12', 'UttarPradesh', 50000, true);
            expect(upRes.employeeContribution).toBe(0);
            expect(upRes.applicableMonth).toBe(false);
        });
    });
});
