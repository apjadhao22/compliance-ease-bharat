/**
 * Indian Statutory Compliance Calculation Engines
 * Production-grade implementations of EPF, ESIC, PT, Bonus, Gratuity, TDS & LWF
 */

// ─── Wage Definition (Code on Wages, 2019 — 50% Rule) ───

export type WageComponents = {
  basic: number;
  da: number;
  retainingAllowance: number;
  allowances: number; // HRA + other allowances (total exclusions)
};

export type WageDefinitionResult = {
  wages: number;
  totalRemuneration: number;
  exclusions: number;
  addedBackToWages: number;
  isCompliant: boolean;
};

/**
 * Applies the 50% wage rule per Code on Wages, 2019.
 * Wages = Basic + DA + Retaining Allowance.
 * Exclusions = HRA + other allowances.
 * If exclusions > 50% of total remuneration, excess is added back to wages.
 */
export function defineWages({ basic, da, retainingAllowance, allowances }: WageComponents): WageDefinitionResult {
  const baseWages = Number(basic || 0) + Number(da || 0) + Number(retainingAllowance || 0);
  const exclusions = Number(allowances || 0);
  const totalRemuneration = baseWages + exclusions;

  if (totalRemuneration <= 0) {
    return { wages: 0, totalRemuneration: 0, exclusions: 0, addedBackToWages: 0, isCompliant: true };
  }

  const maxExclusions = 0.5 * totalRemuneration;

  if (exclusions <= maxExclusions) {
    return { wages: baseWages, totalRemuneration, exclusions, addedBackToWages: 0, isCompliant: true };
  }

  const excess = exclusions - maxExclusions;
  return {
    wages: baseWages + excess,
    totalRemuneration,
    exclusions,
    addedBackToWages: excess,
    isCompliant: false,
  };
}

// ─── EPF (Employees' Provident Fund) ───
/**
 * Calculate EPF contributions per the Employees' Provident Funds & Miscellaneous Provisions Act, 1952.
 * - Employee contribution: 12% of full basic (no ceiling post-2014 amendment)
 * - Employer EPF: 3.67% of basic capped at ₹15,000
 * - Employer EPS: 8.33% of basic capped at ₹15,000
 * @param basic Monthly basic salary
 */
export function calculateEPF(basic: number) {
  const epfWages = basic;
  const epsWages = Math.min(basic, 15000);

  const employeeEPF = Math.round(epfWages * 0.12);
  const employerEPS = Math.round(epsWages * 0.0833);
  const employerEPF = Math.round(epsWages * 0.0367);
  const employerTotal = employerEPF + employerEPS;
  const totalContribution = employeeEPF + employerTotal;

  return { employeeEPF, employerEPF, employerEPS, employerTotal, totalContribution, epfWages, epsWages };
}

// ─── ESIC (Employees' State Insurance Corporation) ───
/**
 * Calculate ESIC contributions per the ESI Act, 1948.
 * - Employee: 0.75% of gross wages
 * - Employer: 3.25% of gross wages
 * - Wage ceiling: ₹21,000/month — employees earning above this are exempt
 * @param gross Monthly gross salary
 */
export function calculateESIC(gross: number) {
  const ceiling = 21000;
  if (gross > ceiling) return { employeeESIC: 0, employerESIC: 0, total: 0, applicable: false };
  const employeeESIC = Math.round(gross * 0.0075);
  const employerESIC = Math.round(gross * 0.0325);
  return { employeeESIC, employerESIC, total: employeeESIC + employerESIC, applicable: true };
}

// ─── Professional Tax (Maharashtra) ───
/**
 * Calculate Professional Tax per Maharashtra State Tax on Professions, Trades, Callings and Employments Act, 1975.
 * Slabs (Maharashtra):
 * - ≤ ₹7,500: Nil
 * - ₹7,501–₹10,000: ₹175
 * - ₹10,001–₹15,000: ₹200
 * - > ₹15,000: ₹200 (₹300 in February for annual adjustment)
 * @param monthlyGross Monthly gross salary
 * @param month Optional month string (YYYY-MM or month name) to detect February
 */
export function calculatePT(monthlyGross: number, month?: string) {
  const isFebruary = month
    ? month.includes('02') || month.toLowerCase().includes('feb')
    : false;

  if (monthlyGross <= 7500) return 0;
  if (monthlyGross <= 10000) return 175;
  if (monthlyGross <= 15000) return 200;
  return isFebruary ? 300 : 200;
}

// ─── Bonus (Payment of Bonus Act, 1965) ───
/**
 * Calculate statutory bonus per the Payment of Bonus Act, 1965.
 * - Eligibility: minimum 30 working days in the accounting year
 * - Wage ceiling: ₹21,000/month (or minimum wages, whichever higher)
 * - Minimum bonus: 8.33%, Maximum: 20%
 * - Eligible months = floor(totalWorkingDays / 20)
 * @param basicSalary Monthly basic salary
 * @param monthsWorked Number of months worked (informational)
 * @param totalWorkingDays Total working days in the accounting year
 * @param bonusPercent Bonus percentage (clamped to 8.33–20)
 */
export function calculateBonus(
  basicSalary: number,
  monthsWorked: number,
  totalWorkingDays: number,
  bonusPercent: number = 8.33
) {
  if (totalWorkingDays < 30) {
    return {
      isEligible: false, eligibleMonths: 0, bonusPercent: 0,
      bonusWages: 0, bonusAmount: 0, reason: 'Minimum 30 working days required',
    };
  }

  const cappedBasic = Math.min(basicSalary, 21000);
  const validPercent = Math.max(8.33, Math.min(bonusPercent, 20));
  const eligibleMonths = Math.floor(totalWorkingDays / 20);
  const bonusWages = cappedBasic * eligibleMonths;
  const bonusAmount = Math.round((bonusWages * validPercent) / 100);

  return { isEligible: true, eligibleMonths, bonusPercent: validPercent, bonusWages, bonusAmount };
}

// ─── Gratuity (Payment of Gratuity Act, 1972) ───
/**
 * Calculate gratuity per the Payment of Gratuity Act, 1972.
 * - Formula: (15 × last drawn salary × completed years of service) / 26
 * - Eligibility: minimum 5 years of continuous service (waived for death/disability)
 * - If remaining months ≥ 6, round up years by 1
 * @param dateOfJoining ISO date string (YYYY-MM-DD)
 * @param dateOfLeaving ISO date string (YYYY-MM-DD)
 * @param lastBasicSalary Last drawn basic + DA
 * @param isDeathOrDisability Waives the 5-year minimum requirement
 */
export function calculateGratuity(
  dateOfJoining: string,
  dateOfLeaving: string,
  lastBasicSalary: number,
  isDeathOrDisability: boolean = false,
  minYearsForEligibility: number = 5
) {
  const joinDate = new Date(dateOfJoining);
  const leaveDate = new Date(dateOfLeaving);
  const diffMs = leaveDate.getTime() - joinDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365.25);
  const remainingDays = diffDays % 365.25;
  const months = Math.floor(remainingDays / 30.44);
  const yearsOfService = months >= 6 ? years + 1 : years;

  if (yearsOfService < minYearsForEligibility && !isDeathOrDisability) {
    return {
      isEligible: false, yearsOfService, monthsOfService: months,
      lastDrawnBasic: lastBasicSalary, gratuityAmount: 0,
      reason: `Minimum ${minYearsForEligibility} years of service required`,
    };
  }

  const gratuityAmount = Math.round((15 * lastBasicSalary * yearsOfService) / 26);
  return { isEligible: true, yearsOfService, monthsOfService: months, lastDrawnBasic: lastBasicSalary, gratuityAmount };
}

// ─── TDS (Income Tax Act — New Regime FY 2025-26) ───
/**
 * Calculate TDS on salaries under the New Tax Regime for FY 2025-26.
 * Slabs: 0–3L nil, 3–7L 5%, 7–10L 10%, 10–12L 15%, 12–15L 20%, 15L+ 30%
 * - Standard deduction: ₹75,000
 * - Section 87A rebate: full rebate if taxable income ≤ ₹7,00,000
 * - Health & Education Cess: 4%
 * @param annualGross Annual gross salary
 * @param standardDeduction Standard deduction amount (default ₹75,000)
 */
export function calculateTDS(annualGross: number, standardDeduction: number = 75000) {
  const taxableIncome = Math.max(0, annualGross - standardDeduction);

  const slabs = [
    { from: 0, to: 300000, rate: 0 },
    { from: 300000, to: 700000, rate: 0.05 },
    { from: 700000, to: 1000000, rate: 0.10 },
    { from: 1000000, to: 1200000, rate: 0.15 },
    { from: 1200000, to: 1500000, rate: 0.20 },
    { from: 1500000, to: Infinity, rate: 0.30 },
  ];

  let tax = 0;
  for (const slab of slabs) {
    if (taxableIncome > slab.from) {
      const taxableInSlab = Math.min(taxableIncome, slab.to) - slab.from;
      tax += taxableInSlab * slab.rate;
    }
  }

  if (taxableIncome <= 700000) tax = 0;

  const cess = Math.round(tax * 0.04);
  const totalTax = Math.round(tax + cess);
  const monthlyTDS = Math.round(totalTax / 12);

  return {
    taxableIncome, annualTax: totalTax, monthlyTDS, cess,
    effectiveRate: taxableIncome > 0 ? ((totalTax / taxableIncome) * 100).toFixed(2) : '0',
  };
}

// ─── LWF (Maharashtra Labour Welfare Fund Act, 1953) ───
/**
 * Calculate Labour Welfare Fund contributions per Maharashtra LWF Act.
 * - Employee: ₹25, Employer: ₹75 (revised rates from March 2024)
 * - Applicable only in June & December (half-yearly)
 * - Due dates: 15 July (for June) and 15 January next year (for December)
 * @param month Month string in YYYY-MM format
 * @param isApplicable Whether LWF is applicable to this employee
 */
export function calculateLWF(month: string, isApplicable: boolean = true) {
  const monthNumber = month.split('-')[1];
  const isLWFMonth = monthNumber === '06' || monthNumber === '12';

  if (!isLWFMonth || !isApplicable) {
    return {
      employeeContribution: 0, employerContribution: 0, totalContribution: 0,
      applicableMonth: false, dueDate: '',
    };
  }

  const year = month.split('-')[0];
  const dueDate = monthNumber === '06'
    ? `15 July ${year}`
    : `15 January ${parseInt(year) + 1}`;

  return {
    employeeContribution: 25, employerContribution: 75, totalContribution: 100,
    applicableMonth: true, dueDate, frequency: 'Half-yearly' as const,
  };
}

// ─── Proration ───
/**
 * Prorate a monthly salary based on actual payable days.
 * @param monthlySalary Full monthly salary
 * @param workingDays Total working days in the month
 * @param payableDays Days the employee is payable for
 */
export function calculateProration(
  monthlySalary: number, workingDays: number, payableDays: number
): number {
  if (workingDays === 0) return 0;
  if (payableDays >= workingDays) return monthlySalary;
  return Math.round((monthlySalary / workingDays) * payableDays);
}

// ─── Overtime ───
/**
 * Calculate overtime pay per the Factories Act, 1948 — double the ordinary rate.
 * @param basicSalary Monthly basic salary
 * @param workingDays Working days in the month
 * @param overtimeHours Total overtime hours worked
 */
export function calculateOvertime(
  basicSalary: number, workingDays: number, overtimeHours: number
): number {
  if (overtimeHours === 0) return 0;
  const dailyRate = basicSalary / workingDays;
  const hourlyRate = dailyRate / 8;
  return Math.round(hourlyRate * 2 * overtimeHours);
}
