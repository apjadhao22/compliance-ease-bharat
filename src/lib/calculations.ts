/**
 * Indian Statutory Compliance Calculation Engines
 * Production-grade implementations of EPF, ESIC, PT, Bonus, Gratuity, TDS & LWF
 */

import { PF_CONFIG, ESIC_CONFIG } from "./config/socialSecurity/pfEsicConfig";
import { BONUS_RULES } from "./config/wage/bonusRules";
import { GRATUITY_RULES } from "./config/socialSecurity/gratuityRules";
import { MATERNITY_RULES } from "./config/socialSecurity/maternityRules";

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
  suggestedStructure: {
    basicDaRetaining: number;
    allowances: number;
  };
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
    return { 
      wages: 0, totalRemuneration: 0, exclusions: 0, addedBackToWages: 0, isCompliant: true,
      suggestedStructure: { basicDaRetaining: 0, allowances: 0 } 
    };
  }

  const maxExclusions = 0.5 * totalRemuneration;
  const suggestedBasicDaAmount = Math.max(baseWages, 0.5 * totalRemuneration);
  const suggestedStructure = {
    basicDaRetaining: suggestedBasicDaAmount,
    allowances: totalRemuneration - suggestedBasicDaAmount
  };

  if (exclusions <= maxExclusions) {
    return { wages: baseWages, totalRemuneration, exclusions, addedBackToWages: 0, isCompliant: true, suggestedStructure };
  }

  const excess = exclusions - maxExclusions;
  return {
    wages: baseWages + excess,
    totalRemuneration,
    exclusions,
    addedBackToWages: excess,
    isCompliant: false,
    suggestedStructure
  };
}

/**
 * Calculate EPF contributions per the Employees' Provident Funds & Miscellaneous Provisions Act, 1952 / Code on Social Security, 2020.
 * Uses config-driven rates.
 * @param basic Monthly basic salary
 * @param workerType Optional worker type to check applicability under Social Security Code
 */
export function calculateEPF(basic: number, workerType: string = 'employee') {
  if (!PF_CONFIG.isApplicableForWorkerTypes.includes(workerType)) {
    return {
      employeeEPF: 0, employerEPF: 0, employerEPS: 0, employerTotal: 0,
      totalContribution: 0, epfWages: 0, epsWages: 0, applicable: false,
      citation: PF_CONFIG.citation
    };
  }

  const epfWages = basic;
  const epsWages = Math.min(basic, PF_CONFIG.wageCeiling);

  const employeeEPF = Math.round(epfWages * PF_CONFIG.employeeRate);
  const employerEPS = Math.round(epsWages * PF_CONFIG.employerEPSRate);
  const employerEPF = Math.round(epsWages * PF_CONFIG.employerPFRate);
  const employerTotal = employerEPF + employerEPS;
  const totalContribution = employeeEPF + employerTotal;

  return { 
    employeeEPF, employerEPF, employerEPS, employerTotal, 
    totalContribution, epfWages, epsWages, applicable: true,
    citation: PF_CONFIG.citation
  };
}

// ─── ESIC (Employees' State Insurance Corporation) ───
/**
 * Calculate ESIC contributions per the ESI Act, 1948 / Code on Social Security 2020.
 * Uses config-driven rates & ceilings.
 * @param gross Monthly gross salary
 * @param workerType Optional worker type
 */
export function calculateESIC(gross: number, workerType: string = 'employee') {
  if (!ESIC_CONFIG.isApplicableForWorkerTypes.includes(workerType)) {
    return { employeeESIC: 0, employerESIC: 0, total: 0, applicable: false, citation: ESIC_CONFIG.citation };
  }

  const ceiling = ESIC_CONFIG.wageCeiling;
  if (gross > ceiling) return { employeeESIC: 0, employerESIC: 0, total: 0, applicable: false, citation: ESIC_CONFIG.citation };
  
  // Statutory Requirement: ESIC contributions must be rounded to the NEXT HIGHER RUPEE
  const employeeESIC = Math.ceil(gross * ESIC_CONFIG.employeeRate);
  const employerESIC = Math.ceil(gross * ESIC_CONFIG.employerRate);
  
  return { 
    employeeESIC, employerESIC, total: employeeESIC + employerESIC, applicable: true,
    citation: ESIC_CONFIG.citation
  };
}

// ─── Aggregator Cess (Gig/Platform Workers) - Placeholder ───
/**
 * TODO: Placeholder for Aggregator Cess Calculation
 * Under Code on Social Security, 2020 (Chapter IX, Section 114)
 * Aggregators must contribute 1% to 2% of annual turnover (capped at 5% of amount payable to gig/platform workers)
 * to the generic Social Security Fund.
 */
export function estimateAggregatorCess(annualTurnover: number, amountPayableToGigWorkers: number) {
  // Placeholder logic until exact rules/notifications are notified for aggregator rates
  const turnoverCess = annualTurnover * 0.01; // Assuming lowest bound 1%
  const cap = amountPayableToGigWorkers * 0.05;
  const estimatedContribution = Math.min(turnoverCess, cap);

  return {
    estimatedContribution,
    isAggregatorApplicable: true,
    citation: {
      codeName: 'Code on Social Security, 2020',
      sectionOrRule: 'Chapter IX, Section 114',
      url: 'https://labour.gov.in/sites/default/files/SS_Code_2020.pdf'
    }
  };
}

// ─── Professional Tax (Multi-State) ───

import { PT_CONFIG_BY_STATE, adjustLastMonthPT } from './config/tax/ptConfig';

/**
 * Calculate Professional Tax with multi-state support.
 * @param monthlyGross Monthly gross salary
 * @param state State where the employee geographically works
 * @param options Calculation options for frequency and gender specific rules
 */
export function calculatePT(
  monthlyGross: number,
  state: string,
  options?: {
    isFebruary?: boolean;       // for MH (March) and KA (Feb) special month
    isLastMonth?: boolean;      // generic "last month of cycle" flag for annual/cap states
    ytdPTSoFar?: number;        // for annual cap enforcement
    gender?: 'male' | 'female' | 'other' | string; // for Maharashtra gender-specific slabs
    halfYearlySalary?: number;  // for KL, TN, Puducherry — pass 6-month total
    annualSalary?: number;      // for MP, BI, JH, OD, CG — pass annual total
  }
): number {
  const config = PT_CONFIG_BY_STATE[state];
  if (!config || !config.isApplicable) return 0;

  // Determine which slabs to use
  let slabs = config.slabs;
  if (config.genderSpecificSlabs && options?.gender) {
    if (options.gender.toLowerCase() === 'female') {
      slabs = config.genderSpecificSlabs.female;
    } else {
      slabs = config.genderSpecificSlabs.male; // fallback male rule for male/other
    }
  }

  if (slabs.length === 0) return 0;

  // Determine the salary figure to match against slabs
  let salaryForSlab = monthlyGross;
  if (config.frequency === 'half-yearly' && options?.halfYearlySalary !== undefined) {
    salaryForSlab = options.halfYearlySalary;
  } else if (config.frequency === 'annual' && options?.annualSalary !== undefined) {
    salaryForSlab = options.annualSalary;
  }

  const slab = slabs.find(s => salaryForSlab >= s.min && salaryForSlab <= s.max);
  if (!slab) return 0;

  let amount = slab.amount;

  // Maharashtra special: Feb/March = ₹300 for eligible slabs
  if (state === 'Maharashtra' && options?.isFebruary && salaryForSlab > (options.gender === 'female' ? 25000 : 10000)) {
    amount = 300;
  }

  // Karnataka special: Feb = ₹300 (New threshold ₹25,000)
  if (state === 'Karnataka' && options?.isFebruary && salaryForSlab >= 25000) {
    amount = 300;
  }

  // Annual cap enforcement
  if (config.annualCap && options?.isLastMonth) {
    amount = adjustLastMonthPT(state, amount, options.ytdPTSoFar ?? 0);
  }

  return amount;
}

// ─── Bonus (Payment of Bonus Act, 1965) ───
/**
 * Calculate statutory bonus per the Payment of Bonus Act, 1965 / Code on Wages, 2019.
 * @param basicDA Monthly basic salary + DA (or "wages" as defined)
 * @param minWage Applicable scheduled minimum wage
 * @param monthsWorked Number of months worked in accounting year
 * @param totalWorkingDays Total working days in the accounting year
 * @param bonusPercent Bonus percentage (clamped to 8.33–20)
 */
export function calculateBonus(
  basicDA: number,
  minWage: number,
  monthsWorked: number,
  totalWorkingDays: number,
  bonusPercent: number = BONUS_RULES.minPercentage
) {
  if (totalWorkingDays < BONUS_RULES.minWorkingDays) {
    return {
      isEligible: false, eligibleMonths: 0, bonusPercent: 0,
      bonusWages: 0, bonusAmount: 0, reason: `Minimum ${BONUS_RULES.minWorkingDays} working days required`,
    };
  }

  if (basicDA > BONUS_RULES.eligibilityWageCeiling) {
    return {
      isEligible: false, eligibleMonths: 0, bonusPercent: 0,
      bonusWages: 0, bonusAmount: 0, reason: `Wages exceed eligibility ceiling of ₹${BONUS_RULES.eligibilityWageCeiling}`,
    };
  }

  // Calculation is based on 7000 or the minimum wage, whichever is higher
  const calculationCeiling = Math.max(BONUS_RULES.calculationCeiling, minWage);
  const applicableMonthlyWage = Math.min(basicDA, calculationCeiling);
  
  const validPercent = Math.max(BONUS_RULES.minPercentage, Math.min(bonusPercent, BONUS_RULES.maxPercentage));
  const bonusWages = applicableMonthlyWage * monthsWorked; // Yearly applicable wages
  const bonusAmount = Math.round((bonusWages * validPercent) / 100);

  return { isEligible: true, eligibleMonths: monthsWorked, bonusPercent: validPercent, bonusWages, bonusAmount, citation: BONUS_RULES.citations[0] };
}

// ─── Gratuity (Payment of Gratuity Act, 1972) ───
/**
 * Calculate gratuity per the Payment of Gratuity Act, 1972 / Code on Social Security 2020.
 * - Formula: (15 × last drawn salary × completed years of service) / 26
 * - Pro-Rata applies for Fixed Term employees (min 1 yr)
 * - Eligibility: minimum 5 years of continuous service (waived for death/disability)
 * - If remaining months ≥ 6, round up years by 1
 * @param dateOfJoining ISO date string (YYYY-MM-DD)
 * @param dateOfLeaving ISO date string (YYYY-MM-DD)
 * @param lastBasicSalary Last drawn basic + DA
 * @param isDeathOrDisability Waives the 5-year minimum requirement
 * @param contractType "Fixed-Term" | "Permanent" (to trigger pro-rata rules)
 */
export function calculateGratuity(
  dateOfJoining: string,
  dateOfLeaving: string,
  lastBasicSalary: number,
  isDeathOrDisability: boolean = false,
  contractType: string = "Permanent"
) {
  const joinDate = new Date(dateOfJoining);
  const leaveDate = new Date(dateOfLeaving);
  const diffMs = leaveDate.getTime() - joinDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365.25);
  const remainingDays = diffDays % 365.25;
  const months = Math.floor(remainingDays / 30.44);
  const yearsOfService = months >= 6 ? years + 1 : years;

  // Code on Social Security fixed-term pro-rata provision
  const minYears = contractType.toLowerCase() === 'fixed-term' || contractType.toLowerCase() === 'fixed_term'
    ? GRATUITY_RULES.minYearsFixedTerm
    : GRATUITY_RULES.minYearsContinuousService;

  if (yearsOfService < minYears && !isDeathOrDisability) {
    return {
      isEligible: false, yearsOfService, monthsOfService: months,
      lastDrawnBasic: lastBasicSalary, gratuityAmount: 0,
      reason: `Minimum ${minYears} years of service required (${contractType})`,
      citation: GRATUITY_RULES.citations[0]
    };
  }

  const rawGratuity = Math.round(lastBasicSalary * GRATUITY_RULES.calculationFactor * yearsOfService);
  const gratuityAmount = Math.min(rawGratuity, GRATUITY_RULES.ceilingAmount);

  return {
    isEligible: true, yearsOfService, monthsOfService: months,
    lastDrawnBasic: lastBasicSalary, gratuityAmount,
    wasCapped: rawGratuity > GRATUITY_RULES.ceilingAmount,
    citation: GRATUITY_RULES.citations[0]
  };
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

// ─── LWF (Multi-State Labour Welfare Fund) ───

import { LWF_CONFIG_BY_STATE } from './config/socialSecurity/lwfConfig';

/**
 * Calculate Labour Welfare Fund contributions per State Act.
 * @param month Month string in YYYY-MM format
 * @param state State where the employee geographically works
 * @param monthlyGross Optional monthly gross required for slab-based computing
 * @param isApplicable Whether LWF is applicable to this employee
 */
export function calculateLWF(
  month: string,
  state: string,
  monthlyGross?: number,
  isApplicable: boolean = true
) {
  if (!isApplicable) return { employeeContribution: 0, employerContribution: 0, totalContribution: 0, applicableMonth: false, dueDate: '' };

  const config = LWF_CONFIG_BY_STATE[state];
  if (!config || !config.isApplicable) return { employeeContribution: 0, employerContribution: 0, totalContribution: 0, applicableMonth: false, dueDate: '' };

  const monthNumber = parseInt(month.split('-')[1], 10);
  const isApplicableMonth = config.applicableMonths.includes(monthNumber);
  
  if (!isApplicableMonth) return { employeeContribution: 0, employerContribution: 0, totalContribution: 0, applicableMonth: false, dueDate: '' };

  let ee = 0, er = 0;
  if (config.contributionType === 'fixed') {
    ee = config.fixedEmployee ?? 0;
    er = config.fixedEmployer ?? 0;
  } else if (config.slabs && monthlyGross !== undefined) {
    const slab = config.slabs.find(s => monthlyGross <= s.maxGross);
    if (slab) { 
      ee = slab.employeeAmount; 
      er = slab.employerAmount; 
    }
  }

  return {
    employeeContribution: ee,
    employerContribution: er,
    totalContribution: ee + er,
    applicableMonth: true,
    dueDate: config.dueDescription,
    frequency: config.frequency,
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

// ─── WC/EC (Workmen's Compensation) ───

export type OccupationRisk = "office_workers" | "light_manual" | "heavy_manual" | "construction";

export const WCRates: Record<OccupationRisk, number> = {
  office_workers: 0.005,
  light_manual: 0.015,
  heavy_manual: 0.03,
  construction: 0.05,
};

export interface WCResult {
  annualPremium: number;
  monthlyPremium: number;
  coverage: string;
  renewalReminder: boolean;
}

export function calculateWC(
  monthlyGross: number,
  occupationRisk: OccupationRisk,
  renewalDate?: string
): WCResult & { monthlyPremium: number } {
  const rate = WCRates[occupationRisk];
  // WC Premium is typically calculated on the actual gross wages for employees above ESIC
  const monthlyPremium = Math.ceil(monthlyGross * rate);
  const annualPremium = monthlyPremium * 12;

  const coverage = occupationRisk === "office_workers"
    ? "Death: ₹1.2L+, Disability: 60% wages × age factor"
    : "Enhanced coverage for manual risk";

  const renewalReminder = renewalDate
    ? new Date(renewalDate) < new Date()
    : false;

  return { annualPremium, monthlyPremium, coverage, renewalReminder };
}

// ─── Maternity Benefit (Maternity Benefit Act, 1961) ───

/**
 * Calculate average daily wage from recent monthly wage amounts.
 * @param monthlyWages Array of monthly wages (typically last 3 months)
 * @param workingDaysPerMonth Standard working days per month (default 26)
 */
export function calculateAverageDailyWage(
  monthlyWages: number[],
  workingDaysPerMonth: number = 26
): number {
  if (monthlyWages.length === 0 || workingDaysPerMonth <= 0) return 0;
  const avgMonthly = monthlyWages.reduce((s, w) => s + w, 0) / monthlyWages.length;
  return Math.round((avgMonthly / workingDaysPerMonth) * 100) / 100;
}

/**
 * Calculate maternity benefit amount.
 * @param days Number of leave days
 * @param averageDailyWage Average daily wage
 */
export function calculateMaternityBenefit(days: number, averageDailyWage: number): number {
  return Math.round(days * averageDailyWage * 100) / 100;
}

/**
 * Estimates total maternity benefit based on available historical wage data and Social Security Code rules.
 * @param dailyWage Average daily wage
 * @param intendedLeaveWeeks Maximum 26 weeks for 1st/2nd child
 * @param isMedicalBonusApplicable Add flat medical bonus if employer doesn't provide prenatal care
 */
export function estimateMaternityBenefitTotal(
  dailyWage: number,
  intendedLeaveWeeks: number = MATERNITY_RULES.maxWeeksNormalDelivery,
  isMedicalBonusApplicable: boolean = true
) {
  const validWeeks = Math.min(intendedLeaveWeeks, MATERNITY_RULES.maxWeeksNormalDelivery);
  const estimatedWages = Math.round(dailyWage * 6 * validWeeks);
  const medicalBonus = isMedicalBonusApplicable ? MATERNITY_RULES.medicalBonus : 0;
  const totalBenefit = estimatedWages + medicalBonus;

  return { estimatedWages, medicalBonus, totalBenefit, validWeeks, citation: MATERNITY_RULES.citations[0] };
}

// ─── WC/EC Premium Estimation ───

export interface WCPremiumInput {
  annualWages: number;
  avgRiskRate: number;
  employeeCount: number;
}

export interface WCPremiumResult {
  estimatedPremium: number;
  perEmployeePerYear: number;
}

/**
 * Estimate WC/EC policy premium from aggregate payroll data.
 * @param input Annual wages, average risk rate (%), and employee count
 */
export function estimateWCPremium(input: WCPremiumInput): WCPremiumResult {
  const estimatedPremium = Math.round((input.annualWages * input.avgRiskRate) / 100 * 100) / 100;
  const perEmployeePerYear = Math.round(estimatedPremium / Math.max(input.employeeCount, 1) * 100) / 100;
  return { estimatedPremium, perEmployeePerYear };
}

// ─── Equal Remuneration Analytics ───

export type PayEquityBand = {
  grade?: string;
  department?: string;
  gender: string;
  headcount: number;
  avgGross: number;
  medianGross: number;
};

export type PayGapFlag = {
  grade?: string;
  department?: string;
  maleAvg: number;
  femaleAvg: number;
  gapPercent: number;
};

type EmployeeForEquity = {
  id: string;
  gender?: string | null;
  grade?: string | null;
  department?: string | null;
};

type PayrollRowForEquity = {
  employee_id: string;
  gross_earnings?: number | null;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Build pay equity bands grouped by grade, department, and gender.
 * @param employees Array of employees with id, gender, grade, department
 * @param payrollRows Array of payroll detail rows for the selected month
 */
export function buildPayEquityBands(
  employees: EmployeeForEquity[],
  payrollRows: PayrollRowForEquity[],
): PayEquityBand[] {
  const payMap = new Map<string, number>();
  for (const row of payrollRows) {
    if (row.gross_earnings != null) payMap.set(row.employee_id, row.gross_earnings);
  }

  const groups = new Map<string, { gender: string; grade?: string; department?: string; values: number[] }>();

  for (const emp of employees) {
    const gross = payMap.get(emp.id);
    if (gross == null) continue;
    const gender = emp.gender || "Unknown";
    const grade = emp.grade || "Unspecified";
    const department = emp.department || "Unspecified";
    const key = `${grade}|${department}|${gender}`;
    if (!groups.has(key)) groups.set(key, { gender, grade, department, values: [] });
    groups.get(key)!.values.push(gross);
  }

  return Array.from(groups.values()).map((g) => ({
    grade: g.grade,
    department: g.department,
    gender: g.gender,
    headcount: g.values.length,
    avgGross: Math.round(g.values.reduce((s, v) => s + v, 0) / g.values.length),
    medianGross: Math.round(median(g.values)),
  }));
}

/**
 * Flag grade+department groups where male/female average pay gap exceeds threshold.
 * @param bands Pay equity bands from buildPayEquityBands
 * @param thresholdPercent Gap % threshold (default 10)
 */
export function flagPayGaps(bands: PayEquityBand[], thresholdPercent: number = 10): PayGapFlag[] {
  const grouped = new Map<string, { male?: PayEquityBand; female?: PayEquityBand }>();

  for (const b of bands) {
    const key = `${b.grade || ""}|${b.department || ""}`;
    if (!grouped.has(key)) grouped.set(key, {});
    const g = grouped.get(key)!;
    if (b.gender.toLowerCase() === "male") g.male = b;
    else if (b.gender.toLowerCase() === "female") g.female = b;
  }

  const flags: PayGapFlag[] = [];
  for (const [, pair] of grouped) {
    if (!pair.male || !pair.female) continue;
    const higher = Math.max(pair.male.avgGross, pair.female.avgGross);
    if (higher === 0) continue;
    const gap = Math.abs(pair.male.avgGross - pair.female.avgGross);
    const gapPercent = Math.round((gap / higher) * 10000) / 100;
    if (gapPercent >= thresholdPercent) {
      flags.push({
        grade: pair.male.grade,
        department: pair.male.department,
        maleAvg: pair.male.avgGross,
        femaleAvg: pair.female.avgGross,
        gapPercent,
      });
    }
  }

  return flags.sort((a, b) => b.gapPercent - a.gapPercent);
}

// ─── Maharashtra Minimum Wages (GOM Notification 2024-25) ─────────────────────
// Zone I (Mumbai, Pune, Nagpur) — effective 1 April 2024

export type SkillCategory = "Unskilled" | "Semi-Skilled" | "Skilled" | "Highly Skilled";

export const MAHARASHTRA_MW: Record<SkillCategory, number> = {
  "Unskilled":      12816,
  "Semi-Skilled":   13996,
  "Skilled":        15296,
  "Highly Skilled": 17056,
};

export interface MWCheckResult {
  isCompliant: boolean;
  minimumWage: number;
  shortfall: number; // 0 if compliant
}

/**
 * Returns whether grossSalary meets the Maharashtra minimum wage for the given skill category.
 * grossSalary should be the total monthly gross (basic + all allowances).
 */
export function checkMinimumWage(
  grossSalary: number,
  skillCategory: SkillCategory | string | null | undefined
): MWCheckResult {
  if (!skillCategory || !(skillCategory in MAHARASHTRA_MW)) {
    return { isCompliant: true, minimumWage: 0, shortfall: 0 }; // cannot check without category
  }
  const mw = MAHARASHTRA_MW[skillCategory as SkillCategory];
  const shortfall = Math.max(0, mw - grossSalary);
  return { isCompliant: shortfall === 0, minimumWage: mw, shortfall };
}

// ─── Retrenchment & Layoff (Industrial Relations Code, 2020) ───
/**
 * TODO: Placeholder structural calculation for Retrenchment Compensation.
 * Under IR Code, Chapter IX (Section 79) or Chapter X (Section 83):
 * Retrenchment compensation is generally 15 days of average pay for every completed year 
 * of continuous service or any part thereof in excess of six months.
 * 
 * @param averageDailyPay The calculated average daily pay (typically preceding 3 calendar months)
 * @param yearsOfService Total completed years of continuous service
 * @param remainingMonths Remaining months of service (to check for > 6 months round off)
 */
export function calculateRetrenchmentCompensation(
  averageDailyPay: number,
  yearsOfService: number,
  remainingMonths: number
): { compensation: number, effectiveYears: number, citation: any } {
  // Round up if > 6 months
  const effectiveYears = remainingMonths > 6 ? yearsOfService + 1 : yearsOfService;

  // 15 days pay per effective year
  const compensation = Math.round(15 * averageDailyPay * effectiveYears);

  return {
    compensation,
    effectiveYears,
    citation: {
      codeName: 'Industrial Relations Code, 2020',
      sectionOrRule: 'Chapter IX/X',
      url: 'https://labour.gov.in/sites/default/files/IR_Code_2020.pdf'
    }
  };
}

/**
 * Computes full retrenchment settlement: statutory compensation + notice pay shortfall.
 * IR Code 2020, Chapter IX §79 / Chapter X §83:
 *   Retrenchment compensation = 15 days average pay × completed years of service
 *   Notice pay shortfall = (noticeDaysRequired − noticeDaysGiven) × daily pay  (min 0)
 * Daily pay is derived as monthlyWage / 26 (standard divisor under Indian labour law).
 *
 * @param yearsOfService    Completed continuous years of service
 * @param monthlyWage       Average monthly wage for the preceding 3 calendar months
 * @param noticeDaysGiven   Actual notice days given to the worker
 * @param noticeDaysRequired Statutory notice period required (usually 30 days for 1+ yr service)
 */
export function computeRetrenchmentCompensation(
  yearsOfService: number,
  monthlyWage: number,
  noticeDaysGiven: number,
  noticeDaysRequired: number
): {
  retrenchmentCompensation: number;
  noticePayShortfall: number;
  total: number;
  dailyPay: number;
  citation: { codeName: string; sectionOrRule: string; url: string };
} {
  const dailyPay = Math.round(monthlyWage / 26);
  const retrenchmentCompensation = yearsOfService * 15 * dailyPay;
  const shortfallDays = Math.max(0, noticeDaysRequired - noticeDaysGiven);
  const noticePayShortfall = shortfallDays * dailyPay;
  const total = retrenchmentCompensation + noticePayShortfall;

  return {
    retrenchmentCompensation,
    noticePayShortfall,
    total,
    dailyPay,
    citation: {
      codeName: 'Industrial Relations Code, 2020',
      sectionOrRule: 'Retrenchment Compensation — Chapter IX §79 / Chapter X §83',
      url: 'https://labour.gov.in/sites/default/files/IR_Code_2020.pdf',
    },
  };
}
