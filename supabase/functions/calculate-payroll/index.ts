import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Math Calculation Helpers ───
const calculateProration = (monthlySalary: number, workingDays: number, payableDays: number) => {
  if (workingDays === 0) return 0;
  if (payableDays >= workingDays) return monthlySalary;
  return Math.round((monthlySalary / workingDays) * payableDays);
};

const defineWages = ({ basic, da, retainingAllowance, allowances }: any) => {
  const baseWages = Number(basic || 0) + Number(da || 0) + Number(retainingAllowance || 0);
  const exclusions = Number(allowances || 0);
  const totalRemuneration = baseWages + exclusions;
  if (totalRemuneration <= 0) return { wages: 0 };
  const maxExclusions = 0.5 * totalRemuneration;
  if (exclusions <= maxExclusions) return { wages: baseWages };
  return { wages: baseWages + (exclusions - maxExclusions) };
};

const calculateOvertime = (basicSalary: number, workingDays: number, overtimeHours: number) => {
  if (overtimeHours === 0) return 0;
  return Math.round(((basicSalary / workingDays) / 8) * 2 * overtimeHours);
};

const calculateEPF = (basic: number) => {
  const epfWages = basic;
  const epsWages = Math.min(basic, 15000);
  return {
    employeeEPF: Math.round(epfWages * 0.12),
    employerEPF: Math.round(epsWages * 0.0367),
    employerEPS: Math.round(epsWages * 0.0833),
  };
};

const calculateESIC = (wages: number) => {
  if (wages > 21000) return { employeeESIC: 0, employerESIC: 0 };
  return {
    employeeESIC: Math.round(wages * 0.0075),
    employerESIC: Math.round(wages * 0.0325),
  };
};

const calculatePT = (monthlyGross: number, monthState: string = "Maharashtra") => {
  if (monthlyGross <= 7500) return 0;
  if (monthlyGross <= 10000) return 175;
  if (monthlyGross <= 15000) return 200;
  const isFebruary = monthState.includes("02") || monthState.toLowerCase().includes("feb");
  return isFebruary ? 300 : 200;
};

const calculateTDS = (annualGross: number, standardDeduction = 75000) => {
  const taxableIncome = Math.max(0, annualGross - standardDeduction);
  let tax = 0;
  if (taxableIncome > 1500000) tax += (taxableIncome - 1500000) * 0.30 + 150000;
  else if (taxableIncome > 1200000) tax += (taxableIncome - 1200000) * 0.20 + 90000;
  else if (taxableIncome > 900000) tax += (taxableIncome - 900000) * 0.15 + 45000;
  else if (taxableIncome > 600000) tax += (taxableIncome - 600000) * 0.10 + 15000;
  else if (taxableIncome > 300000) tax += (taxableIncome - 300000) * 0.05;
  return { annualTDS: Math.round(tax), monthlyTDS: Math.round(tax / 12) };
};

const calculateLWF = (month: string, isApplicable: boolean = true) => {
  const monthNumber = month.split('-')[1];
  if ((monthNumber !== '06' && monthNumber !== '12') || !isApplicable) {
    return { employeeContribution: 0, employerContribution: 0 };
  }
  return { employeeContribution: 25, employerContribution: 75 };
};

const BATCH_SIZE = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { companyId, month, workingDays, regime } = await req.json();

    // ─── Fetch leave summary server-side ───
    const [yearStr, monthStr] = month.split("-");
    const monthStart = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const monthEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const { data: approvedLeaves } = await supabase
      .from("leave_requests")
      .select("employee_id, leave_type, days_count")
      .eq("company_id", companyId)
      .eq("status", "Approved")
      .lte("start_date", monthEnd)
      .gte("end_date", monthStart);

    const leaveSummary = new Map<string, { paidDays: number; unpaidDays: number }>();
    for (const lv of approvedLeaves || []) {
      const empLeave = leaveSummary.get(lv.employee_id) || { paidDays: 0, unpaidDays: 0 };
      const days = Number(lv.days_count || 0);
      if (lv.leave_type === "Unpaid") {
        empLeave.unpaidDays += days;
      } else {
        empLeave.paidDays += days;
      }
      leaveSummary.set(lv.employee_id, empLeave);
    }

    // ─── Fetch expense summary server-side ───
    const { data: approvedExpenses } = await supabase
      .from("expenses")
      .select("employee_id, amount")
      .eq("company_id", companyId)
      .eq("status", "Approved")
      .gte("date", monthStart)
      .lte("date", monthEnd);

    const expenseMap = new Map<string, number>();
    for (const exp of approvedExpenses || []) {
      expenseMap.set(exp.employee_id, (expenseMap.get(exp.employee_id) || 0) + Number(exp.amount));
    }

    // ─── Process employees in batches ───
    const payrollDetails: any[] = [];
    const alerts: string[] = [];
    let totalProcessed = 0;
    let offset = 0;
    let hasMore = true;

    // Get total active employee count for IR code alert
    const { count: activeHeadcount } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["Active", "active"]);

    if (regime === "labour_codes" && (activeHeadcount || 0) >= 300) {
      alerts.push(`Industrial Relations Code: Company headcount has reached ${activeHeadcount}. Mandatory Standing Orders must be formulated.`);
    }

    while (hasMore) {
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .in("status", ["Active", "active"])
        .range(offset, offset + BATCH_SIZE - 1);

      if (empError) throw empError;
      if (!employees || employees.length === 0) {
        hasMore = false;
        break;
      }

      for (const emp of employees) {
        const basic = Number(emp.basic || 0);
        const da = Number(emp.da || 0);
        const retaining = Number(emp.retaining_allowance || 0);
        const hra = Number(emp.hra || 0);
        const otherAllowances = Number(emp.allowances || 0);

        const empLeaves = leaveSummary.get(emp.id) || { paidDays: 0, unpaidDays: 0 };
        const paidLeaves = empLeaves.paidDays;
        const unpaidLeaves = empLeaves.unpaidDays;
        
        const daysPresent = Math.max(0, workingDays - paidLeaves - unpaidLeaves);
        const payableDays = Math.max(0, workingDays - unpaidLeaves);

        const basicPaid = calculateProration(basic, workingDays, payableDays);
        const daPaid = calculateProration(da, workingDays, payableDays);
        const retainingPaid = calculateProration(retaining, workingDays, payableDays);
        const hraPaid = calculateProration(hra, workingDays, payableDays);
        const allowancesPaid = calculateProration(otherAllowances, workingDays, payableDays);
        const totalAllowancesPaid = hraPaid + allowancesPaid;

        let wagesBase = basicPaid;
        if (regime === "labour_codes") {
          const result = defineWages({ basic: basicPaid, da: daPaid, retainingAllowance: retainingPaid, allowances: totalAllowancesPaid });
          wagesBase = result.wages;
          if (wagesBase < 15000 && payableDays >= 26) {
            alerts.push(`Warning: ${emp.name}'s statutory wages are below the ₹15,000 Labour Code threshold.`);
          }
        }

        const overtimePay = calculateOvertime(basic, workingDays, 0);
        const reimbursement = expenseMap.get(emp.id) || 0;
        const grossEarnings = basicPaid + daPaid + retainingPaid + hraPaid + allowancesPaid + overtimePay + reimbursement;

        const epf = emp.epf_applicable ? calculateEPF(regime === "labour_codes" ? wagesBase : basicPaid) : { employeeEPF: 0, employerEPF: 0, employerEPS: 0 };
        const esicWages = regime === "labour_codes" ? wagesBase : grossEarnings;
        const esic = emp.esic_applicable ? calculateESIC(esicWages) : { employeeESIC: 0, employerESIC: 0 };
        const pt = emp.pt_applicable ? calculatePT(grossEarnings, month) : 0;
        const tds = calculateTDS(grossEarnings * 12);
        const lwf = calculateLWF(month, true);

        const totalDeductions = epf.employeeEPF + esic.employeeESIC + pt + tds.monthlyTDS + lwf.employeeContribution;
        const netPay = grossEarnings - totalDeductions;

        payrollDetails.push({
          employee_id: emp.id,
          days_present: daysPresent,
          paid_leaves: paidLeaves,
          unpaid_leaves: unpaidLeaves,
          overtime_hours: 0,
          basic_paid: basicPaid,
          hra_paid: hraPaid,
          allowances_paid: allowancesPaid,
          overtime_pay: overtimePay,
          gross_earnings: grossEarnings,
          epf_employee: epf.employeeEPF,
          epf_employer: epf.employerEPF,
          eps_employer: epf.employerEPS,
          esic_employee: esic.employeeESIC,
          esic_employer: esic.employerESIC,
          pt,
          tds: tds.monthlyTDS,
          lwf_employee: lwf.employeeContribution,
          lwf_employer: lwf.employerContribution,
          total_deductions: totalDeductions,
          net_pay: netPay,
        });
      }

      totalProcessed += employees.length;
      offset += BATCH_SIZE;

      // If we got fewer than BATCH_SIZE, we've reached the end
      if (employees.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    return new Response(JSON.stringify({ payrollDetails, alerts, totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
