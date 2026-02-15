// Indian statutory compliance calculation engines

// ─── EPF ───
export function calculateEPF(basic: number) {
  const employeeShare = Math.round(basic * 0.12); // 12% of basic
  const epsCeiling = Math.min(basic, 15000);
  const epsContribution = Math.round(epsCeiling * 0.0833); // 8.33% capped at ₹15,000
  const employerEPF = Math.round(basic * 0.12) - epsContribution; // 3.67% effectively
  const employerTotal = Math.round(basic * 0.12); // employer also pays 12%
  return {
    employeeEPF: employeeShare,
    employerEPF: employerTotal - epsContribution,
    employerEPS: epsContribution,
    employerTotal,
    totalContribution: employeeShare + employerTotal,
  };
}

// ─── ESIC ───
export function calculateESIC(gross: number) {
  const ceiling = 21000;
  if (gross > ceiling) return { employeeESIC: 0, employerESIC: 0, total: 0, applicable: false };
  const employeeESIC = Math.round(gross * 0.0075); // 0.75%
  const employerESIC = Math.round(gross * 0.0325); // 3.25%
  return { employeeESIC, employerESIC, total: employeeESIC + employerESIC, applicable: true };
}

// ─── Professional Tax (Maharashtra) ───
export function calculatePT(monthlyGross: number, isFebruary: boolean = false) {
  if (monthlyGross <= 7500) return 0;
  if (monthlyGross <= 10000) return 175;
  if (monthlyGross <= 15000) return 200;
  return isFebruary ? 312 : 300;
}

// ─── Bonus (Payment of Bonus Act 1965) ───
export function calculateBonus(basic: number, percentage: number = 8.33) {
  const rate = Math.max(8.33, Math.min(20, percentage));
  const annualBasic = basic * 12;
  // Bonus Act: calculation ceiling is ₹7,000/month or minimum wage, whichever is higher
  // Using basic directly for simplicity
  return { annualBonus: Math.round(annualBasic * rate / 100), rate };
}

// ─── Gratuity (Payment of Gratuity Act 1972) ───
export function calculateGratuity(lastDrawnSalary: number, yearsOfService: number) {
  if (yearsOfService < 5) return { amount: 0, eligible: false };
  // Formula: (15 × last drawn salary × years of service) / 26
  const amount = Math.round((15 * lastDrawnSalary * yearsOfService) / 26);
  return { amount, eligible: true };
}

// ─── TDS (New Tax Regime FY 2025-26) ───
export function calculateTDS(annualGross: number) {
  const standardDeduction = 75000;
  const taxableIncome = Math.max(0, annualGross - standardDeduction);

  // New regime FY 2025-26 slabs
  const slabs = [
    { upto: 400000, rate: 0 },
    { upto: 800000, rate: 0.05 },
    { upto: 1200000, rate: 0.10 },
    { upto: 1600000, rate: 0.15 },
    { upto: 2000000, rate: 0.20 },
    { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
  ];

  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;

  for (const slab of slabs) {
    const slabAmount = Math.min(remaining, slab.upto - prevLimit);
    if (slabAmount <= 0) break;
    tax += slabAmount * slab.rate;
    remaining -= slabAmount;
    prevLimit = slab.upto;
  }

  // Section 87A rebate: if taxable income ≤ ₹12,00,000, full rebate (tax = 0)  
  if (taxableIncome <= 1200000) tax = 0;

  // Health & Education Cess: 4%
  const cess = Math.round(tax * 0.04);
  const totalTax = Math.round(tax + cess);
  const monthlyTDS = Math.round(totalTax / 12);

  return { taxableIncome, annualTax: totalTax, monthlyTDS, cess };
}

// ─── LWF (Maharashtra) ───
export function calculateLWF() {
  return { employee: 25, employer: 75, total: 100, frequency: "Half-yearly" as const };
}
