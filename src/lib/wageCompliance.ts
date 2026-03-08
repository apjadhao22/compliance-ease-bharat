import { WAGE_PAYMENT_RULES } from './config/wage/paymentRules';

export interface WagePaymentValidation {
  isCompliant: boolean;
  deadlineWarning: string | null;
  deductionWarning: string | null;
  prohibitedDeductionWarning: string | null;
  citation: typeof WAGE_PAYMENT_RULES.citations[0];
}

/**
 * Checks wage payment deadlines and deduction limits against the Code on Wages.
 * @param wagePeriod 'daily' | 'weekly' | 'fortnightly' | 'monthly'
 * @param grossWage Total gross wages payable
 * @param totalDeductions Sum of all deductions for the period
 * @param fineDeductions Any fines specifically included in totalDeductions
 * @param isCooperative If the employee is part of a cooperative society (changes max deduction)
 */
export function validateWagePayment(
  wagePeriod: 'daily' | 'weekly' | 'fortnightly' | 'monthly',
  grossWage: number,
  totalDeductions: number,
  fineDeductions: number,
  isCooperative: boolean = false
): WagePaymentValidation {
  const deadline = WAGE_PAYMENT_RULES.paymentDeadlines[wagePeriod];
  const deadlineWarning = `Ensure payment is made: ${deadline}`;

  const maxDeductionPercent = isCooperative 
    ? WAGE_PAYMENT_RULES.deductionLimits.cooperativeSocietyPercentage 
    : WAGE_PAYMENT_RULES.deductionLimits.generalMaxPercentage;
  
  const maxDeductionAllowed = (grossWage * maxDeductionPercent) / 100;
  
  let deductionWarning = null;
  if (totalDeductions > maxDeductionAllowed) {
    deductionWarning = `Total deductions exceed the statutory limit of ${maxDeductionPercent}% of wages.`;
  }

  let prohibitedDeductionWarning = null;
  const maxFineAllowed = grossWage * 0.03;
  if (fineDeductions > maxFineAllowed) {
    prohibitedDeductionWarning = `Fines exceed the statutory limit of 3% of wages.`;
  }

  return {
    isCompliant: !deductionWarning && !prohibitedDeductionWarning,
    deadlineWarning,
    deductionWarning,
    prohibitedDeductionWarning,
    citation: WAGE_PAYMENT_RULES.citations[0]
  };
}
