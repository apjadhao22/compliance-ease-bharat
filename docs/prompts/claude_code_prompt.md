# OpticompBharat — State-wise PT, LWF & Labour Codes Compliance Implementation

You are working on **OpticompBharat**, an Indian statutory compliance & payroll SaaS. Tech stack: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui frontend, Supabase (Postgres + Auth + Deno Edge Functions) backend, OpenAI gpt-4o-mini for AI features, Vitest + Playwright for testing.

> **⚠️ CRITICAL LEGAL CONTEXT (as of March 2026):**
>
> **All four Labour Codes are now legally in force since 21 November 2025** (notified via Official Gazette by the Ministry of Labour & Employment). This is NOT speculative — the codes have replaced 29 legacy labour laws:
> - Code on Wages, 2019 (replaces Payment of Wages Act, Minimum Wages Act, Payment of Bonus Act, Equal Remuneration Act)
> - Code on Social Security, 2020 (replaces EPF Act, ESI Act, Gratuity Act, Maternity Benefit Act, etc.)
> - Industrial Relations Code, 2020 (replaces Industrial Disputes Act, Trade Unions Act, Industrial Employment Standing Orders Act)
> - OSH Code, 2020 (replaces Factories Act, Contract Labour Act, Inter-State Migrant Workmen Act, etc.)
>
> **Draft Central Rules** were published on 30 December 2025 for public consultation. Final rules expected by **1 April 2026**. During the transition, existing rules/regulations continue in force where new rules are not yet notified.
>
> **State-level rules** are still being finalized in most states. A few states have notified final state rules.
>
> **Implication for this codebase:** The `compliance_regime` toggle (`legacy_acts` vs `labour_codes`) is now more important than ever. Companies should be defaulting to `labour_codes` since the codes are in force. The app should guide users toward the new regime and show warnings if they're still on `legacy_acts`.

Execute the following 8-phase plan **in order**. Each phase has numbered steps — complete every step before moving to the next phase. After each phase, run `npx vitest run` to confirm nothing is broken. Commit after each phase with message `feat(compliance): Phase N — <short description>`.

---

## CODEBASE CONTEXT (read before writing any code)

### Key files you'll be modifying:
- `src/lib/calculations.ts` — All statutory calculators (EPF, ESIC, PT, LWF, TDS, bonus, gratuity, etc.)
- `src/lib/config/` — Config directory with subdirs: `wage/`, `socialSecurity/`, `osh/`, `se/`, `ir/`, `leave/`
- `supabase/functions/calculate-payroll/index.ts` — Batch payroll engine Edge Function
- `supabase/functions/calculate-fnf/index.ts` — Full & Final settlement Edge Function
- `supabase/functions/audit-payroll/index.ts` — AI payroll auditor Edge Function
- `supabase/functions/copilot-chat/index.ts` — AI compliance copilot Edge Function
- `src/pages/dashboard/ProfessionalTax.tsx` — PT page (currently MH-only)
- `src/pages/dashboard/LWF.tsx` — LWF page (currently MH-only)
- `src/pages/dashboard/Payroll.tsx` — Main payroll page
- `src/pages/dashboard/CompanySetup.tsx` — Company profile (state selector, regime toggle)
- `src/pages/dashboard/Overview.tsx` — Dashboard command center
- `src/pages/dashboard/ComplianceCalendar.tsx` — Deadline tracker
- `src/pages/dashboard/OSH.tsx` — Occupational Safety page
- `src/pages/dashboard/IR.tsx` — Industrial Relations page
- `src/lib/wageCompliance.ts` — Payment deadline & deduction limit rules
- `src/lib/oshCompliance.ts` — Working hours validator
- `src/lib/seCompliance.ts` — S&E rules validator

### Current state of PT:
- `PTSlabs` record in calculations.ts covers only: Maharashtra, Karnataka, TamilNadu, Telangana, Kerala, Gujarat, Other
- `calculatePT(monthlyGross, monthOrState?, isFebruaryOverride?)` — February adjustment only for Maharashtra
- ProfessionalTax.tsx is hardcoded to MH Form III / IIIA PDFs
- Payroll edge function calls a local `calculatePT()` with simplified MH slabs, does NOT pass company state

### Current state of LWF:
- `calculateLWF(month, isApplicable)` — hardcoded to Maharashtra: ₹25 employee / ₹75 employer, June & December only
- Payroll edge function has its own `calculateLWF()` also hardcoded to MH
- LWF page shows only MH rates

### Compliance regime:
- Companies choose `legacy_acts` or `labour_codes` (stored in `companies.compliance_regime`)
- `defineWages()` implements the 50% rule (basic+DA ≥ 50% of gross)
- When `labour_codes`: payroll uses `defineWages()` output for PF/ESIC base

---

## CRITICAL ARCHITECTURAL FIX — BEFORE ANYTHING ELSE

> **PT and LWF are levied based on the employee's WORK LOCATION STATE, not the company's registered office state.**
>
> A company registered in Maharashtra can have employees working in Karnataka, Tamil Nadu, West Bengal, etc. Each employee's PT must be calculated per the state where they physically work. Same applies to LWF — the state of work determines the applicable contribution, frequency, and filing.
>
> **Current codebase problem:** There is NO `work_state` or `work_location` field on the `employees` table. The app uses `companies.state` (a single value) as a proxy for ALL employees. This means a multi-state employer currently cannot calculate correct PT or LWF for employees in different states.

### Pre-Phase 1 Step: Add `work_state` to employees table

**1. Database migration:**
```sql
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_state text;

-- Backfill: set all existing employees' work_state to their company's state
UPDATE public.employees e
SET work_state = c.state
FROM public.companies c
WHERE e.company_id = c.id AND e.work_state IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.employees.work_state IS 'State where the employee physically works. PT and LWF are calculated based on this, not the company registered state.';
```

**2. UI — Add Employee dialog (`src/pages/dashboard/Employees.tsx`):**

The Add Employee dialog has 4 tabs: "Identity & Work", "Compensation", "Statutory & Registration", "WC / EC Coverage". The `work_state` field belongs in **Tab 1 ("Identity & Work")** since it's a fundamental work attribute.

a) **Add to `newEmp` state object:**
```typescript
const [newEmp, setNewEmp] = useState({
  // ...existing fields...
  work_state: "",  // ADD THIS — will default to companyState on render
});
```

b) **Add the field in Tab 1, after the Gender dropdown (Row 1 currently has: Employee Code, Full Name, Gender in a 4-col grid).** Change the grid to 5 columns or add a new Row 1.5:
```tsx
<div className="space-y-1.5">
  <Label>Work Location (State) <span className="text-destructive">*</span></Label>
  <select
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    value={newEmp.work_state || companyState}
    onChange={(e) => setNewEmp((p) => ({ ...p, work_state: e.target.value }))}
  >
    {ALL_INDIAN_STATES.map(s => (
      <option key={s.value} value={s.value}>{s.label}</option>
    ))}
  </select>
  <p className="text-[11px] text-muted-foreground">
    PT &amp; LWF are calculated based on work location, not company registered address.
  </p>
</div>
```

c) **Define `ALL_INDIAN_STATES` array** at the top of the file (or better, in a shared config like `src/lib/config/indianStates.ts`):
```typescript
export const ALL_INDIAN_STATES = [
  { value: "AndhraPradesh", label: "Andhra Pradesh" },
  { value: "ArunachalPradesh", label: "Arunachal Pradesh" },
  { value: "Assam", label: "Assam" },
  { value: "Bihar", label: "Bihar" },
  { value: "Chhattisgarh", label: "Chhattisgarh" },
  { value: "Delhi", label: "Delhi" },
  { value: "Goa", label: "Goa" },
  { value: "Gujarat", label: "Gujarat" },
  { value: "Haryana", label: "Haryana" },
  { value: "HimachalPradesh", label: "Himachal Pradesh" },
  { value: "JammuKashmir", label: "Jammu & Kashmir" },
  { value: "Jharkhand", label: "Jharkhand" },
  { value: "Karnataka", label: "Karnataka" },
  { value: "Kerala", label: "Kerala" },
  { value: "Ladakh", label: "Ladakh" },
  { value: "MadhyaPradesh", label: "Madhya Pradesh" },
  { value: "Maharashtra", label: "Maharashtra" },
  { value: "Manipur", label: "Manipur" },
  { value: "Meghalaya", label: "Meghalaya" },
  { value: "Mizoram", label: "Mizoram" },
  { value: "Nagaland", label: "Nagaland" },
  { value: "Odisha", label: "Odisha" },
  { value: "Puducherry", label: "Puducherry" },
  { value: "Punjab", label: "Punjab" },
  { value: "Rajasthan", label: "Rajasthan" },
  { value: "Sikkim", label: "Sikkim" },
  { value: "TamilNadu", label: "Tamil Nadu" },
  { value: "Telangana", label: "Telangana" },
  { value: "Tripura", label: "Tripura" },
  { value: "UttarPradesh", label: "Uttar Pradesh" },
  { value: "Uttarakhand", label: "Uttarakhand" },
  { value: "WestBengal", label: "West Bengal" },
];
```
Use this same array in CompanySetup.tsx to replace whatever state list is there currently, ensuring consistency.

d) **Include `work_state` in the insert call.** The existing `supabase.from("employees").insert({...})` call must include `work_state: newEmp.work_state || companyState`.

e) **Default value on dialog open:** When the dialog opens, pre-fill `work_state` with `companyState` so single-state companies don't have to touch it.

**3. UI — "Bulk Work State Update" button and dialog on Employees page:**

Follow the exact same pattern as the existing "Bulk WC Risk Update" dialog. Add a new button next to it:

```tsx
<Button variant="outline" onClick={() => setBulkWorkStateDialogOpen(true)}>
  Bulk Work State Update
</Button>
```

The dialog should have:

a) **Scope selector** (radio buttons, same as WC bulk update):
   - "Current search results ({filteredEmployees.length})"
   - "All employees ({employees.length})"
   - **"Selected employees only"** — add a checkbox column to the employee table so users can multi-select specific employees (this is important for mixed-state teams)

b) **State dropdown:**
```tsx
<div className="space-y-1.5">
  <Label>New Work Location State</Label>
  <select value={bulkWorkState} onChange={(e) => setBulkWorkState(e.target.value)}>
    {ALL_INDIAN_STATES.map(s => (
      <option key={s.value} value={s.value}>{s.label}</option>
    ))}
  </select>
  <p className="text-[11px] text-muted-foreground">
    This will update PT and LWF calculations for the selected employees from the next payroll run.
  </p>
</div>
```

c) **Preview count:** Show "This will update X employee(s) to work state: {state}"

d) **Apply handler:**
```typescript
const handleBulkWorkStateApply = async () => {
  const target = bulkWorkStateScope === "selected" 
    ? selectedEmployees 
    : bulkWorkStateScope === "filtered" 
      ? filteredEmployees 
      : employees;
  const ids = target.map(e => e.id);
  
  const { error } = await supabase
    .from("employees")
    .update({ work_state: bulkWorkState })
    .in("id", ids);
    
  if (error) { /* toast error */ return; }
  refreshEmployees();
  setBulkWorkStateDialogOpen(false);
  toast({ title: "Work state updated", description: `Updated ${ids.length} employee(s) to ${bulkWorkState}.` });
};
```

**4. UI — Show `work_state` in the employee table:**

Add a "Work State" column to the employee list table in `Employees.tsx`. Display it as a compact badge:
```tsx
<TableCell>
  <Badge variant="outline" className="text-xs">
    {emp.work_state || companyState}
  </Badge>
</TableCell>
```

This makes it immediately visible which state each employee is mapped to, and makes it obvious when someone hasn't been assigned a work state yet (falls back to company state).

**5. Bulk Upload (`src/components/EmployeeBulkUpload.tsx`):**

Add `work_state` to the column mapping options. The mapper should:
- Include "Work Location State" in the field list for mapping
- Accept state names in any reasonable format (e.g., "Maharashtra", "maharashtra", "MH") and normalize to PascalCase keys matching `ALL_INDIAN_STATES`
- If the CSV doesn't have a work_state column, default all imported employees to `companyState`

**6. Employee edit/inline edit:**

If the employee table supports inline editing or has an edit dialog, `work_state` must be editable there too. Check if there's an edit flow and add the field.

**7. Update ALL PT and LWF calculations to use `employee.work_state` instead of `companies.state`:**
- `supabase/functions/calculate-payroll/index.ts` — for each employee in the loop, use `emp.work_state || companyState` as the PT/LWF state
- `src/pages/dashboard/ProfessionalTax.tsx` — group employees by `work_state` and show PT breakdown per state
- `src/pages/dashboard/LWF.tsx` — same: group by work state
- `src/pages/dashboard/Payroll.tsx` — show work_state in payroll results table
- All PDF form generators (Form III, Form IIIA, etc.) — generate per-state forms

**5. Payroll summary impact:**
- Monthly PT challan filing is per-state (company must file separate PT returns in each state where employees work)
- LWF remittance is per-state
- The PT page should show a state-wise summary: "Maharashtra: 45 employees, Total PT ₹9,000 | Karnataka: 12 employees, Total PT ₹2,400 | ..."
- Compliance Calendar must generate separate PT/LWF deadlines per state where the company has employees

**6. Edge cases to handle:**
- Employee transfers between states mid-month: use the state as of the payroll processing date (or the state for the majority of the month)
- Employee with `work_state = NULL`: fall back to `companies.state` with a warning alert
- Remote employees: work_state = state where they physically sit, not where the company is
- Employees on deputation: work_state = deputation location state

This is a prerequisite for everything in Phases 1-5. Without this, multi-state PT/LWF will not work correctly.

---

## PHASE 1 — State-wise PT Data & Config Layer

### Step 1.1: Create `src/lib/config/tax/ptConfig.ts`

Create this NEW file with a comprehensive PT configuration for ALL Indian states/UTs. Use these TypeScript interfaces:

```typescript
import { Citation } from '../wage/types';

export interface PTSlab {
  min: number;
  max: number;       // use Infinity for open-ended
  amount: number;
}

export interface PTStateConfig {
  state: string;
  stateCode: string;  // e.g. "MH", "KA", "WB"
  isApplicable: boolean;  // false for Delhi, Haryana, RJ, UP, UK, etc.
  slabs: PTSlab[];
  genderSpecificSlabs?: {  // Maharashtra has different slabs for male/female
    male: PTSlab[];
    female: PTSlab[];
  };
  frequency: 'monthly' | 'half-yearly' | 'annual' | 'N/A';  // KL/TN/Puducherry=half-yearly, MP/BI/JH/OD=annual
  annualCap: number | null;  // e.g. 2500 for AP, MP, OD; null if no cap
  febAdjustment: boolean;    // whether special-month adjustment applies (MH March, KA Feb)
  specialMonth?: number;     // 2=February, 3=March — which month gets the higher rate
  specialMonthAmount?: number; // the higher amount for that month (typically ₹300)
  formNames: string[];       // e.g. ["Form III", "Form IIIA"]
  filingUrl: string;
  citation: Citation;
  notes?: string;  // e.g. "Act exists but not enforced" for Delhi
}
```

Populate for these states with the following slab data:

**States already in codebase (migrate from PTSlabs in calculations.ts):**
- Maharashtra (MALE): ≤7500→₹0, 7501–10000→₹175, ≥10001→₹200 (Feb: ₹300). No annual cap. **Maharashtra (FEMALE): ≤25000→₹0, ≥25001→₹200 (Feb: ₹300). Gender-based slabs — women get higher exemption threshold of ₹25,000.**
- Karnataka: ≤24999→₹0, ≥25000→₹200 (Feb: ₹300). No annual cap. **IMPORTANT: Karnataka revised slabs effective 1 April 2025 via Karnataka Act No. 33 of 2025 — old threshold was ₹15,000, now ₹25,000. Feb raised from ₹200 to ₹300 to hit ₹2,500 annual cap.**
- TamilNadu: **HALF-YEARLY slabs (not monthly):** Half-yearly salary ≤21000→₹0, 21001–30000→₹180, 30001–45000→₹425, 45001–60000→₹930, 60001–75000→₹1025, 75001–100000→₹1250. **Deducted twice per year, not monthly.** No annual cap.
- Telangana: ≤15000→₹0, 15001–20000→₹150, >20000→₹200. No annual cap.
- Kerala: **HALF-YEARLY slabs:** Half-yearly salary ≤11999→₹0, 12000–17999→₹320, 18000–29999→₹450, 30000–44999→₹600, 45000–99999→₹750, 100000–124999→₹1000, 125000–200000→₹1250. **Deducted twice per year, not monthly.** No annual cap.
- Gujarat: ≤12000→₹0, >12000→₹200. No annual cap.

**New states to add (VERIFIED FY 2025-26 slabs from official sources):**

- West Bengal: Monthly — ≤10000→₹0, 10001–15000→₹110, 15001–25000→₹130, 25001–40000→₹150, >40000→₹200. No annual cap. Forms: "Form III, Annual Return". Penalty: 1% pm interest + 50% penalty.
- Andhra Pradesh: Monthly — ≤15000→₹0, 15001–20000→₹150, >20000→₹200. Annual cap ₹2,500 (Feb adjustment: ₹300 for >20000 in the last month to hit cap). Forms: "Form V".
- Madhya Pradesh: **ANNUAL salary slabs (not monthly):** Annual ≤225000→₹0, 225001–300000→₹1500/yr, 300001–400000→₹2000/yr, >400000→₹2500/yr. **Convert to monthly deduction: ₹208/mo for 11 months + ₹212 in last month for top slab.** Forms: "e-Return".
- Assam: Monthly — ≤15000→₹0, 15001–25000→₹180, >25000→₹208. No annual cap. Forms: "Manual returns".
- Odisha: **ANNUAL salary slabs:** Annual ≤160000→₹0, 160001–300000→₹1500/yr, >300000→₹2400/yr. Forms: "e-Filing".
- Jharkhand: **ANNUAL salary slabs:** Annual ≤300000→₹0, 300001–500000→₹1200/yr, 500001–800000→₹1800/yr, 800001–1000000→₹2100/yr, >1000000→₹2500/yr. Forms: "e-Filing via JTAX".
- Bihar: **ANNUAL salary slabs:** Annual ≤300000→₹0, 300001–500000→₹1000/yr, 500001–1000000→₹2000/yr, >1000000→₹2500/yr. Forms: "Manual".
- Meghalaya: Monthly — ≤50000→₹0, 50001–75000→₹200, 75001–100000→₹300, 100001–150000→₹500, 150001–200000→₹750, 200001–250000→₹1000, 250001–300000→₹1250, 300001–350000→₹1500, 350001–400000→₹1800, 400001–450000→₹2100, 450001–500000→₹2400, >500000→₹2500. No annual cap.
- Tripura: Monthly — ≤7500→₹0, 7501–15000→₹150, >15000→₹208. No annual cap. Forms: "Manual".
- Manipur: Monthly — ≤50000→₹0, 50001–75000→₹1200/yr, 75001–100000→₹2000/yr, 100001–125000→₹2400/yr, >125000→₹2500/yr. **Annual slabs converted to monthly deductions.** Forms: "Manual".
- Sikkim: Monthly — ≤20000→₹0, 20001–30000→₹125, 30001–40000→₹150, >40000→₹200. Annual cap ₹2,500. Forms: "Manual".
- Chhattisgarh: Same structure as MP (follows MP Vritti Kar pattern). Annual ≤225000→₹0, 225001–300000→₹1500/yr, >300000→₹2500/yr. Forms: "e-Filing".
- Goa: Monthly — ≤15000→₹0, 15001–25000→₹150, >25000→₹200. No annual cap. Forms: "Manual/e-Filing".
- Punjab: Monthly — >25000→₹200 (flat). Below ₹25,000 → Nil. **Note: Punjab now levies PT per Saral.pro 2025-26 data.**
- Puducherry: **HALF-YEARLY slabs:** ≤99999→₹0, 100000–200000→₹250, 200001–300000→₹500, 300001–400000→₹750, 400001–500000→₹1000, >500000→₹1250. **Deducted twice per year.**

**Non-PT states (set isApplicable: false, slabs: []):**
- Rajasthan, Uttar Pradesh, Uttarakhand, Haryana, Himachal Pradesh, Jammu & Kashmir, Ladakh, Andaman & Nicobar, Lakshadweep, Dadra & Nagar Haveli, Daman & Diu, Arunachal Pradesh, Mizoram, Nagaland

**IMPORTANT NOTE on Delhi:** Delhi has an enabling provision under the Delhi Municipal Corporation Act but **PT has never been implemented or enforced for salaried employees as of FY 2025-26**. Set Delhi as `isApplicable: false` with a comment: "Act exists but not enforced. Monitor for future implementation."

**CRITICAL: Frequency handling.** The `PTStateConfig` interface MUST support three frequency types:
- `'monthly'` — MH, KA, WB, GJ, AP, TG, Assam, Tripura, Goa, Punjab, Sikkim
- `'half-yearly'` — Kerala, Tamil Nadu, Puducherry
- `'annual'` — MP, Bihar, Jharkhand, Odisha, Chhattisgarh, Meghalaya, Manipur

Update the interface accordingly:
```typescript
frequency: 'monthly' | 'half-yearly' | 'annual' | 'N/A';
```

**CRITICAL: Gender-based slabs.** Maharashtra has different slabs for male and female employees. The `PTStateConfig` interface MUST support this. Add:
```typescript
genderSpecificSlabs?: {
  male: PTSlab[];
  female: PTSlab[];
};
```
When `genderSpecificSlabs` is present, use it instead of the generic `slabs` array. This requires an `employee.gender` parameter in `calculatePT()`.

Export as `PT_STATE_CONFIGS: PTStateConfig[]` and also as a lookup map `PT_CONFIG_BY_STATE: Record<string, PTStateConfig>`.

### Step 1.2: Add annual cap helpers

In the same `ptConfig.ts` file, add:

```typescript
export function getAnnualPTCap(state: string): number | null {
  return PT_CONFIG_BY_STATE[state]?.annualCap ?? null;
}

export function adjustLastMonthPT(
  state: string,
  monthlyPT: number,
  ytdPTSoFar: number  // PT already deducted in months 1-11
): number {
  const cap = getAnnualPTCap(state);
  if (!cap) return monthlyPT;  // no cap, return normal amount
  const remaining = Math.max(0, cap - ytdPTSoFar);
  return Math.min(monthlyPT, remaining);
}
```

### Step 1.3: Refactor `calculatePT()` in `src/lib/calculations.ts`

Replace the existing `PTSlabs` record and `calculatePT()` with:

```typescript
import { PT_CONFIG_BY_STATE, adjustLastMonthPT } from './config/tax/ptConfig';

export function calculatePT(
  monthlyGross: number,
  state: string,
  options?: {
    isFebruary?: boolean;       // for MH (March) and KA (Feb) special month
    isLastMonth?: boolean;      // generic "last month of cycle" flag for annual/cap states
    ytdPTSoFar?: number;        // for annual cap enforcement
    gender?: 'male' | 'female'; // for Maharashtra gender-specific slabs
    halfYearlySalary?: number;  // for KL, TN, Puducherry — pass 6-month total
    annualSalary?: number;      // for MP, BI, JH, OD, CG — pass annual total
  }
): number {
  const config = PT_CONFIG_BY_STATE[state];
  if (!config || !config.isApplicable) return 0;

  // Determine which slabs to use
  let slabs = config.slabs;
  if (config.genderSpecificSlabs && options?.gender) {
    slabs = config.genderSpecificSlabs[options.gender];
  }

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

  // For half-yearly states, slab.amount IS the half-yearly amount — return as-is (caller handles frequency)
  // For annual states, slab.amount IS the annual amount — caller divides by 12 or deducts differently

  // Maharashtra special: Feb/March = ₹300 for eligible slabs
  if (state === 'Maharashtra' && options?.isFebruary && salaryForSlab > (options.gender === 'female' ? 25000 : 10000)) {
    amount = 300;
  }

  // Karnataka special: Feb = ₹300
  if (state === 'Karnataka' && options?.isFebruary && salaryForSlab >= 25000) {
    amount = 300;
  }

  // Annual cap enforcement
  if (config.annualCap && options?.isLastMonth) {
    amount = adjustLastMonthPT(state, amount, options.ytdPTSoFar ?? 0);
  }

  return amount;
}
```

**IMPORTANT:** Maharashtra uses March (not February) as its special month in some interpretations. The codebase currently uses February. **Verify:** Per official MH rules, the ₹300 is deducted in February (the last month of the financial year cycle for PT purposes in MH). Karnataka's ₹300 is also in February. The `isFebruary` flag should work for both. Add a code comment noting this.

**IMPORTANT:** This is a breaking change. Update ALL call sites:
- `supabase/functions/calculate-payroll/index.ts` — pass `companyState` instead of month string
- `supabase/functions/calculate-fnf/index.ts` — pass state
- `src/pages/dashboard/ProfessionalTax.tsx` — pass state
- `src/pages/dashboard/Payroll.tsx` — if it calls calculatePT directly
- Any test files referencing calculatePT

Remove the old `PTSlabs` record and `PTState` type from calculations.ts (they now live in ptConfig.ts).

### Step 1.4: Ensure CompanySetup.tsx state dropdown covers ALL states/UTs

Check `src/pages/dashboard/CompanySetup.tsx`. The state `<select>` must include every Indian state and UT. If any are missing, add them. The value stored in DB must match the keys used in `PT_CONFIG_BY_STATE` exactly.

### Step 1.5: Write Vitest unit tests

Create `tests/unit/pt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePT } from '../../src/lib/calculations';

describe('calculatePT — multi-state', () => {
  // Karnataka (REVISED April 2025 — threshold now ₹25,000)
  it('KA: ₹24,999 gross → ₹0', () => expect(calculatePT(24999, 'Karnataka')).toBe(0));
  it('KA: ₹25,000 gross → ₹200', () => expect(calculatePT(25000, 'Karnataka')).toBe(200));
  it('KA: ₹50,000 gross → ₹200', () => expect(calculatePT(50000, 'Karnataka')).toBe(200));
  it('KA: ₹50,000 Feb → ₹300', () => expect(calculatePT(50000, 'Karnataka', { isFebruary: true })).toBe(300));

  // Maharashtra MALE
  it('MH Male: ₹7,500 gross → ₹0', () => expect(calculatePT(7500, 'Maharashtra', { gender: 'male' })).toBe(0));
  it('MH Male: ₹8,000 gross → ₹175', () => expect(calculatePT(8000, 'Maharashtra', { gender: 'male' })).toBe(175));
  it('MH Male: ₹12,000 gross → ₹200', () => expect(calculatePT(12000, 'Maharashtra', { gender: 'male' })).toBe(200));
  it('MH Male: ₹20,000 Feb → ₹300', () => expect(calculatePT(20000, 'Maharashtra', { isFebruary: true, gender: 'male' })).toBe(300));

  // Maharashtra FEMALE (higher exemption: ₹25,000)
  it('MH Female: ₹20,000 → ₹0', () => expect(calculatePT(20000, 'Maharashtra', { gender: 'female' })).toBe(0));
  it('MH Female: ₹25,000 → ₹0', () => expect(calculatePT(25000, 'Maharashtra', { gender: 'female' })).toBe(0));
  it('MH Female: ₹26,000 → ₹200', () => expect(calculatePT(26000, 'Maharashtra', { gender: 'female' })).toBe(200));

  // West Bengal (NEW)
  it('WB: ₹10,000 → ₹0', () => expect(calculatePT(10000, 'WestBengal')).toBe(0));
  it('WB: ₹12,000 → ₹110', () => expect(calculatePT(12000, 'WestBengal')).toBe(110));
  it('WB: ₹20,000 → ₹130', () => expect(calculatePT(20000, 'WestBengal')).toBe(130));
  it('WB: ₹35,000 → ₹150', () => expect(calculatePT(35000, 'WestBengal')).toBe(150));
  it('WB: ₹50,000 → ₹200', () => expect(calculatePT(50000, 'WestBengal')).toBe(200));

  // Andhra Pradesh with annual cap
  it('AP: ₹25,000 → ₹200', () => expect(calculatePT(25000, 'AndhraPradesh')).toBe(200));
  it('AP: Feb with YTD 2300 → ₹200 (cap 2500, remaining 200)', () =>
    expect(calculatePT(25000, 'AndhraPradesh', { isFebruary: true, ytdPTSoFar: 2300 })).toBe(200));

  // Non-PT states
  it('Delhi: any gross → ₹0 (act exists but not enforced)', () => expect(calculatePT(100000, 'Delhi')).toBe(0));
  it('Haryana: any gross → ₹0', () => expect(calculatePT(100000, 'Haryana')).toBe(0));
  it('Rajasthan: any gross → ₹0', () => expect(calculatePT(100000, 'Rajasthan')).toBe(0));
  it('UP: any gross → ₹0', () => expect(calculatePT(100000, 'UttarPradesh')).toBe(0));

  // Punjab (NOW has PT — ₹200 for >₹25,000)
  it('Punjab: ₹20,000 → ₹0', () => expect(calculatePT(20000, 'Punjab')).toBe(0));
  it('Punjab: ₹30,000 → ₹200', () => expect(calculatePT(30000, 'Punjab')).toBe(200));

  // Goa
  it('Goa: ₹15,000 → ₹0', () => expect(calculatePT(15000, 'Goa')).toBe(0));
  it('Goa: ₹20,000 → ₹150', () => expect(calculatePT(20000, 'Goa')).toBe(150));
  it('Goa: ₹30,000 → ₹200', () => expect(calculatePT(30000, 'Goa')).toBe(200));

  // Add similar tests for KA, TN, TG, KL, GJ, MP, AS, OD, JH, BI, MG, TR, MN, SK, CG
});
```

Write at least 2 tests per state: one below threshold (→₹0) and one above. For cap states, test the cap logic.

---

## PHASE 2 — State-wise LWF Data & Config Layer

### Step 2.1: Create `src/lib/config/socialSecurity/lwfConfig.ts`

```typescript
import { Citation } from '../wage/types';

export interface LWFSlabEntry {
  maxGross: number;   // Infinity for open-ended
  employeeAmount: number;
  employerAmount: number;
}

export interface LWFStateConfig {
  state: string;
  stateCode: string;
  isApplicable: boolean;
  contributionType: 'fixed' | 'slab';
  fixedEmployee?: number;
  fixedEmployer?: number;
  slabs?: LWFSlabEntry[];
  frequency: 'half-yearly' | 'annual';
  applicableMonths: number[];  // 1-indexed: [6,12] = Jun+Dec, [1] = Jan only
  dueDescription: string;
  formName: string;
  filingUrl: string;
  citation: Citation;
}
```

Populate with this data:

| State | Employee | Employer | Frequency | Months | Due |
|-------|----------|----------|-----------|--------|-----|
| Maharashtra | ₹25 (fixed) | ₹75 (fixed) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Karnataka | ₹20 (fixed) | ₹40 (fixed) | Annual | [1] | 15 January |
| Tamil Nadu | Slab: ≤5000→₹25, 5001–10000→₹50, >10000→₹75 | 2× employee | Half-yearly | [6, 12] | 15 Jan / 15 Jul |
| Andhra Pradesh | ₹30 (fixed) | ₹70 (fixed) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Telangana | ₹2 (fixed) | ₹5 (fixed) | Annual | [1] | 31 January |
| West Bengal | Slab: ≤5000→₹3/₹6, 5001–7500→₹5/₹10, >7500→₹12/₹24 | (in slab) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Gujarat | Slab: ≤6000→₹6/₹12, 6001–9000→₹12/₹24, >9000→₹18/₹36 | (in slab) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Madhya Pradesh | Slab: ≤5000→₹10/₹30, 5001–7500→₹20/₹60, >7500→₹30/₹90 | (in slab) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Chhattisgarh | ₹15 (fixed) | ₹45 (fixed) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Odisha | ₹20 (fixed) | ₹40 (fixed) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Jharkhand | ₹20 (fixed) | ₹40 (fixed) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |
| Goa | ₹60 (fixed) | ₹120 (fixed) | Half-yearly | [6, 12] | 15 Jul / 15 Jan |

Non-LWF states (isApplicable: false): Punjab, Haryana, Rajasthan, UP, UK, Delhi, Bihar, Assam, HP, J&K, and all NE states except those listed above.

Export as `LWF_STATE_CONFIGS` array and `LWF_CONFIG_BY_STATE` map.

### Step 2.2: Refactor `calculateLWF()` in `src/lib/calculations.ts`

Replace the existing function:

```typescript
import { LWF_CONFIG_BY_STATE } from './config/socialSecurity/lwfConfig';

export function calculateLWF(
  month: string,        // YYYY-MM
  state: string,
  monthlyGross?: number,  // needed for slab-based states
  isApplicable: boolean = true
) {
  if (!isApplicable) return { employeeContribution: 0, employerContribution: 0, totalContribution: 0, applicableMonth: false, dueDate: '' };

  const config = LWF_CONFIG_BY_STATE[state];
  if (!config || !config.isApplicable) return { employeeContribution: 0, employerContribution: 0, totalContribution: 0, applicableMonth: false, dueDate: '' };

  const monthNumber = parseInt(month.split('-')[1]);
  const isApplicableMonth = config.applicableMonths.includes(monthNumber);
  if (!isApplicableMonth) return { employeeContribution: 0, employerContribution: 0, totalContribution: 0, applicableMonth: false, dueDate: '' };

  let ee = 0, er = 0;
  if (config.contributionType === 'fixed') {
    ee = config.fixedEmployee!;
    er = config.fixedEmployer!;
  } else if (config.slabs && monthlyGross !== undefined) {
    const slab = config.slabs.find(s => monthlyGross <= s.maxGross);
    if (slab) { ee = slab.employeeAmount; er = slab.employerAmount; }
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
```

**Update all call sites** — the function now requires `state` as second param and `monthlyGross` for slab states.

### Step 2.3: Write Vitest unit tests

Create `tests/unit/lwf.test.ts`. Test each state: applicable month returns correct amounts, non-applicable month returns zero, slab-based states return correct tier, non-LWF states return zero.

### Step 2.4: Wire company.state into all LWF call sites

Update:
- `supabase/functions/calculate-payroll/index.ts` — replace hardcoded MH logic with `calculateLWF(month, companyState, grossEarnings)`
- `src/pages/dashboard/LWF.tsx` — read company state, display state-specific rates
- `supabase/functions/calculate-fnf/index.ts` — pass state

---

## PHASE 3 — Payroll Engine Integration

### Step 3.1: State-aware PT in calculate-payroll Edge Function

In `supabase/functions/calculate-payroll/index.ts`:

1. The `companyState` is already queried. But now, for each employee in the loop, use `emp.work_state || companyState` as the PT state. **This is the key change — PT is per-employee, not per-company.**
2. For annual cap states: before calculating PT for each employee, query the `pt_calculations` table (or `payroll_details`) for YTD PT already deducted for that employee in the current financial year (April–March).
3. Pass `{ isFebruary, ytdPTSoFar, gender: emp.gender }` to `calculatePT()`.
4. Remove the old local `calculatePT()` function and import from `src/lib/calculations.ts` (or inline the same logic if edge functions can't import from src — in that case, copy the config data into the edge function or fetch from a DB table).
5. For half-yearly PT states (KL, TN, Puducherry): only deduct PT in the applicable months (typically June and December, or as per state rules). For monthly PT states, deduct every month.
6. For annual PT states (MP, BI, JH, OD, CG, Meghalaya, Manipur): divide annual amount by 12 and deduct monthly, OR deduct in specific months as per company preference. Add a config option.

**NOTE:** Edge functions run in Deno and can't directly import from `src/`. You have two options:
- (A) Copy the PT config data into the edge function file (simpler, but duplicated)
- (B) Create a `pt_state_configs` Supabase table and query it at runtime (more maintainable)

Choose option (A) for now and add a TODO comment for migrating to (B) later.

### Step 3.2: State-aware LWF in calculate-payroll Edge Function

Replace the hardcoded `calculateLWF()` in the edge function with multi-state logic. **Use `emp.work_state || companyState` for each employee** — same principle as PT. LWF also follows the employee's work location state. Same approach as PT — copy LWF config data into the edge function for now.

### Step 3.3: Verify PF base under Labour Codes

In the payroll edge function, when `regime === 'labour_codes'`:
- EPF should be calculated on `wagesBase` (output of `defineWages()`), NOT on `basicPaid`
- Verify the current code does this correctly. The line should be: `calculateEPF(wagesBase)` when labour_codes, `calculateEPF(basicPaid)` when legacy_acts
- Check edge cases: what if DA is very high (DA > basic)? What if retaining allowance pushes basic+DA above 50%?
- Add a comment explaining the logic

### Step 3.4: Enforce deduction ceiling

After calculating all deductions (EPF + ESIC + PT + LWF + TDS + advances + other), add:

```typescript
const totalDeductions = epf.employeeEPF + esicEmployee + pt + lwf.employeeContribution + tds.monthlyTDS + advanceDeduction + otherDeductions;
const deductionBase = regime === 'labour_codes' ? wagesBase : grossEarnings;
const maxDeduction = deductionBase * 0.50;  // 75% if includes housing advance
if (totalDeductions > maxDeduction) {
  alerts.push(`Warning: ${emp.name}'s total deductions (₹${totalDeductions}) exceed 50% of wages (₹${deductionBase}). Code on Wages §17 limits deductions to 50%.`);
}
```

### Step 3.5: Update calculate-fnf Edge Function

In `supabase/functions/calculate-fnf/index.ts`:
- Pass company state to PT calculation for the final month
- If the employee exits in February of a cap state, compute the correct final PT amount using YTD logic

---

## PHASE 4 — UI Enhancements

### Step 4.1: Redesign ProfessionalTax.tsx for multi-state employee grouping

In `src/pages/dashboard/ProfessionalTax.tsx`:

1. On mount, fetch ALL employees with their `work_state` field (not just company.state)
2. Group employees by `work_state` to determine which states the company has employees in
3. Import `PT_CONFIG_BY_STATE` from ptConfig.ts
4. **Show a state-wise summary at the top:** "Maharashtra: 45 employees, ₹9,000 | Karnataka: 12 employees, ₹2,400 | West Bengal: 8 employees, ₹1,040"
5. Below the summary, show a tabbed or accordion view — one section per state with:
   - The state's PT slabs displayed as cards (for gender-specific states like MH, show both male/female tables)
   - Employee list filtered to that state with their individual PT amounts
   - Special month note (Feb for KA, Feb/March for MH) and annual cap info where applicable
   - Frequency note for half-yearly (KL, TN) and annual (MP, BI, etc.) states
   - For non-PT states (if any employees are in Delhi, RJ, etc.): show "PT not applicable in {state}"
6. Challan tracking must be **per-state** — separate challan number, payment date, and amount for each state where employees work

### Step 4.2: Update PT Form PDF generation

The `generateFormIII()` and `generateFormIIIA()` functions are MH-specific. Refactor:
- Generate **separate PDFs per state** — one for each state where employees work
- For MH: keep Form III / IIIA format
- For other states: generate a generic "PT Return" PDF with the state name, applicable rule reference, and employee-wise PT breakdown
- The PDF title/header should reference the state's actual form name from config
- Each PDF only includes employees whose `work_state` matches that state

### Step 4.3: Redesign LWF.tsx for multi-state

In `src/pages/dashboard/LWF.tsx`:
1. Fetch ALL employees with their `work_state` field
2. Group employees by `work_state`
3. Import `LWF_CONFIG_BY_STATE`
4. Show state-wise summary: for each state where employees work, show the contribution rates, frequency, and total LWF liability
5. For non-applicable states: show "LWF is not applicable in {state}" with list of employees there
6. For fixed-contribution states: show simple rate card (Employee: ₹X, Employer: ₹Y)
7. For slab-based states (TN, WB, GJ, MP): render a table showing the slabs
8. Show correct frequency and applicable months per state
9. Challan/remittance tracking must be per-state

### Step 4.4: Update Payroll.tsx

In the payroll results table:
- Add a "Work State" column showing each employee's `work_state`
- Add a tooltip on the PT amount showing the specific slab that was applied for that employee's state
- LWF column should show the correct state-specific amount per employee (not hardcoded ₹25/₹75)
- Add a state-wise summary row or footer grouping PT/LWF totals by state

### Step 4.5: Create Salary Restructure Advisor

Create `src/components/SalaryRestructureAdvisor.tsx`:

A utility component (can be placed on the Company Setup page or as a modal) that:
1. Takes current salary breakup: basic, DA, HRA, other allowances
2. Checks if basic+DA ≥ 50% of total gross
3. If NOT compliant, recommends a restructured breakup where basic+DA = 50% of gross, redistributing the excess to basic
4. Shows a before/after comparison table with impact on: EPF (higher), ESIC (if applicable), gratuity (higher), take-home (lower)
5. Only visible when `compliance_regime === 'labour_codes'`

---

## PHASE 5 — Compliance Calendar & Alerts

### Step 5.1: Auto-populate state-specific PT due dates

In `src/pages/dashboard/ComplianceCalendar.tsx` (or the data-fetching hook it uses):
1. Query all DISTINCT `work_state` values from employees table for the company
2. For each state where employees work, look up PT config and generate calendar entries with that state's filing deadlines (MH: last of month, KA: 20th, etc.)
3. **Generate separate entries per state:** "PT filing due — Maharashtra (45 employees)" and "PT filing due — Karnataka (12 employees)"
4. For half-yearly PT states (KL, TN): generate entries only for the applicable 6-month periods
5. For annual PT states: generate a single annual deadline

### Step 5.2: Auto-populate state-specific LWF due dates

Same approach — based on distinct employee work states:
- For each state where employees work, look up LWF config
- For half-yearly states: add entries for the applicable months from config
- For annual states: add entry for January or the specified month
- Each entry should show: state name, number of employees, estimated LWF amount, due date

### Step 5.3: Surface payment deadline alerts

From `src/lib/wageCompliance.ts`, the rules are:
- < 1000 employees: wages due by 7th of following month
- ≥ 1000 employees: wages due by 10th
Add these as calendar entries. On the Overview page, if today > the deadline and payroll hasn't been processed for the month, show a warning alert.

### Step 5.4: Proactive dashboard alerts

In `src/pages/dashboard/Overview.tsx`, add alert cards in the proactive alerts section:
- "PT filing due in {X} days for {state}" — query compliance_calendar for upcoming PT deadlines
- "LWF deduction month: {month}" — if current or next month is an LWF applicable month
- "Wage payment deadline: {date}" — if approaching the 7th/10th

---

## PHASE 6 — Remaining Labour Code Compliance Gaps

### Step 6.1: OSH Code — Women night-shift consent tracking

1. **DB Migration:** Add to `employees` table:
   - `consent_night_shift` (boolean, default false)
   - `consent_night_shift_date` (date, nullable)
2. **OSH page:** In `src/pages/dashboard/OSH.tsx`, add a section "Night Shift Compliance" that:
   - Lists female employees working shifts that include hours between 7 PM–6 AM
   - Flags those without `consent_night_shift = true`
   - Shows a warning: "OSH Code 2020, Chapter VI — Women employees require documented consent for night shifts"
3. **oshCompliance.ts:** Add a validation function `checkNightShiftConsent(employee)` that returns compliance status

### Step 6.2: OSH Code — Inter-state migrant worker tracking

1. **DB Migration:** Add to `employees` table:
   - `is_migrant_worker` (boolean, default false)
   - `home_state` (text, nullable)
   - `displacement_allowance_applicable` (boolean, default false)
2. **OSH page:** Add "Inter-State Migrant Workers" section:
   - List migrant workers with their home state
   - Show displacement allowance calculation: 50% of monthly wages
   - Reference: OSH Code 2020, Chapter X
3. **oshCompliance.ts:** Add `calculateDisplacementAllowance(monthlyWages)` → returns 50% of wages

### Step 6.3: OSH Code — Welfare facility checklist

In `src/pages/dashboard/OSH.tsx`, add a "Welfare Facilities Compliance" card:
- Read employee headcount from Supabase
- Check against thresholds from `src/lib/config/osh/welfareRules.ts`:
  - Canteen: ≥100 workers
  - Crèche: ≥50 workers
  - Welfare Officer: ≥250 workers
  - Safety Committee: ≥250 workers
- For each: show ✅ "Not required (X employees)" or ⚠️ "Required — {facility} must be provided (X employees, threshold: Y)"
- Add a "Mark as Compliant" toggle for each facility (store in a new `welfare_compliance` table or in company settings)

### Step 6.4: IR Code — Retrenchment/closure workflow

In `src/pages/dashboard/IR.tsx`, add a "Retrenchment & Closure" section (visible only when `compliance_regime === 'labour_codes'` and headcount ≥ 300):

1. Show info: "Under IR Code 2020 (Ch X), establishments with ≥300 workers need prior Govt permission for retrenchment, closure, or lay-off"
2. Add a workflow tracker:
   - Step 1: 90-day notice filed (date, reference number)
   - Step 2: Govt permission status (pending/approved/rejected)
   - Step 3: Affected employee list (select employees)
   - Step 4: Compensation calculator: 15 days average pay × completed years of service
3. Store in a new `retrenchment_cases` table (company_id, notice_date, permission_status, affected_employees jsonb, compensation_amount)

### Step 6.5: IR Code — Fixed-term worker equality check

Create `src/lib/config/ir/fixedTermRules.ts`:

```typescript
export interface FixedTermEqualityCheck {
  area: string;
  rule: string;
  check: (fixedTermEmp: any, permanentEmps: any[]) => { compliant: boolean; detail: string };
}

export const FIXED_TERM_CHECKS: FixedTermEqualityCheck[] = [
  {
    area: 'Wages',
    rule: 'IR Code §2(o): Fixed-term workers entitled to same wages as permanent workers in same role',
    check: (ft, perms) => {
      const sameRole = perms.filter(p => p.designation === ft.designation);
      if (sameRole.length === 0) return { compliant: true, detail: 'No comparable permanent workers' };
      const avgPermanentBasic = sameRole.reduce((s, p) => s + p.basic, 0) / sameRole.length;
      const diff = Math.abs(ft.basic - avgPermanentBasic) / avgPermanentBasic;
      return { compliant: diff < 0.1, detail: `Fixed-term basic: ₹${ft.basic}, Avg permanent: ₹${avgPermanentBasic.toFixed(0)}` };
    }
  },
  {
    area: 'Gratuity',
    rule: 'SS Code §53(1): Fixed-term workers eligible for pro-rata gratuity after 1 year',
    check: (ft) => {
      // Check if gratuity was calculated for fixed-term workers with >1yr tenure
      return { compliant: true, detail: 'Verify gratuity eligibility during F&F' };
    }
  },
  // Add checks for: leave entitlement, bonus, ESIC/EPF coverage
];
```

In IR.tsx, add a "Fixed-Term Worker Audit" card that runs these checks against the employee database.

### Step 6.6: IR Code — Strike/lockout notice tracker

In IR.tsx, add a "Strike & Lockout Notices" section:
- Simple CRUD for notices: date_filed, notice_type ('strike' | 'lockout'), notice_period_days (60 for general, 14 for public utility), expiry_date, status ('active' | 'resolved' | 'expired')
- Show countdown: "Notice expires in X days"
- Store in `ir_events` table (which already exists — add a `sub_type` field if needed)

### Step 6.7: SS Code — Unorganised worker registry

Create a simple component (can be a new tab on the Social Security or Employees page):
- List workers marked as `worker_type = 'unorganised'` (the `social_security_worker_types` table already exists)
- For each, track: Aadhaar number, bank account, nominee, e-Shram registration number, registration date
- Show eligible schemes: PM-SVANidhi, PMJJBY, PMSBY, APY based on worker category
- Reference: SS Code 2020, Chapter IX §142

---

## PHASE 7 — AI & Audit Upgrades

### Step 7.1: Update audit-payroll Edge Function

In `supabase/functions/audit-payroll/index.ts`:

1. The system prompt already mentions PT check. Replace the generic heuristic ("PT is suspiciously 0 for high-grossing employees where state PT slabs usually apply (e.g. > ₹10,000 gross)") with the actual state's PT threshold:
   - Include the company state in the prompt context
   - Add: "The company is in {state}. PT slabs for this state: {actual slabs}. Flag if PT deducted doesn't match the applicable slab."
2. For LWF check: Replace the generic "usually June/Dec" with the actual state's applicable months: "LWF in {state} is applicable in {months} with employee contribution ₹{amount}."
3. Add the state context to the prompt alongside the existing regime context.

### Step 7.2: Update copilot-chat Edge Function

In `supabase/functions/copilot-chat/index.ts`:

Enrich the system prompt with state-specific data:

```
CRITICAL CONTEXT:
- Company state: ${stateContext}
- Compliance regime: ${regimeContext}
- PT slabs for ${stateContext}: ${JSON.stringify(ptSlabsForState)}
- LWF for ${stateContext}: Employee ₹${lwfEe}, Employer ₹${lwfEr}, applicable in ${lwfMonths}
- PT annual cap: ${ptCap || 'None'}
```

This allows the copilot to answer questions like "What is my PT this month?", "When is LWF due?", "Am I compliant with the 50% rule?" with accurate state-specific data.

### Step 7.3: Regime-aware compliance health score

In `src/pages/dashboard/Overview.tsx`, update the health score calculation to include:
- PT compliance: PT deducted matches state slabs for all employees (weight: 15%)
- LWF timeliness: LWF deducted in applicable months (weight: 10%)
- 50% wage rule: All employees have basic+DA ≥ 50% of gross when labour_codes (weight: 20%)
- Payment deadline: Payroll processed before the 7th/10th (weight: 15%)
- Welfare facilities: Checklist completion (weight: 10%)
- Existing checks: EPF/ESIC/TDS/min wage (weight: 30%)

---

## PHASE 8 — Database Migrations & Testing

### Step 8.1: Create Supabase migrations

Create migration files in `supabase/migrations/` for:

```sql
-- Add employee work location state (PT/LWF are based on work location, not company state)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_state text;
-- Backfill existing employees with company state
UPDATE employees e SET work_state = c.state FROM companies c WHERE e.company_id = c.id AND e.work_state IS NULL;
COMMENT ON COLUMN employees.work_state IS 'State where employee physically works. PT and LWF calculated based on this.';

-- Add migrant worker fields
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_migrant_worker boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_state text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS consent_night_shift boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS consent_night_shift_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'permanent';  -- 'permanent', 'fixed_term', 'casual', 'apprentice'

-- Retrenchment cases table
CREATE TABLE IF NOT EXISTS retrenchment_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  notice_date date NOT NULL,
  notice_reference text,
  permission_status text DEFAULT 'pending',  -- pending, approved, rejected
  affected_employee_ids jsonb DEFAULT '[]',
  compensation_total numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Welfare compliance tracking
CREATE TABLE IF NOT EXISTS welfare_compliance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  facility_type text NOT NULL,  -- canteen, creche, welfare_officer, safety_committee
  is_compliant boolean DEFAULT false,
  compliance_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE retrenchment_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE welfare_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company retrenchment cases" ON retrenchment_cases
  FOR ALL USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own company welfare compliance" ON welfare_compliance
  FOR ALL USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
```

### Step 8.2: E2E tests for PT multi-state

In `tests/e2e/`:
- Navigate to Company Setup, set state to different values
- Navigate to PT page, verify the displayed slabs match the state
- For a non-PT state (Punjab), verify "PT not applicable" message
- Run payroll and verify PT amounts in payroll details

### Step 8.3: E2E tests for LWF multi-state

- Set company state to Karnataka, verify LWF shows annual frequency with ₹20/₹40
- Set month to January, run payroll, verify LWF is deducted
- Set month to June, verify LWF is NOT deducted for Karnataka (annual, Jan only)
- For Maharashtra, verify June and December both trigger LWF

### Step 8.4: Integration test — full payroll cycle under labour_codes

Create a comprehensive E2E test:
1. Set company: state=Maharashtra, regime=labour_codes
2. Add an employee: basic=15000, DA=5000, HRA=5000, allowances=5000 (gross=30000, basic+DA=20000 = 66% ✓)
3. Run payroll for June
4. Verify:
   - PT = ₹200 (MH slab for >₹15000)
   - LWF employee = ₹25, employer = ₹75 (June is applicable)
   - EPF calculated on wagesBase (not just basic)
   - ESIC calculated correctly
   - Total deductions ≤ 50% of wages
   - Min wage check passes
5. Run payroll for July
6. Verify LWF = 0 (July is not an LWF month for MH)

---

## EXECUTION NOTES

- **Start with the Pre-Phase 1 `work_state` migration.** This is a prerequisite for everything else. Without `employees.work_state`, PT/LWF will calculate using company state for all employees, which is wrong for multi-state employers.
- **Run `npx vitest run` after each phase.** Fix any failures before proceeding.
- **Don't break existing tests.** The refactored `calculatePT()` and `calculateLWF()` signatures are breaking changes — update ALL call sites.
- **Edge function duplication:** Since Supabase Edge Functions (Deno) can't import from `src/lib/`, you'll need to copy PT/LWF config data into the edge function files. Add `// TODO: Migrate to pt_state_configs DB table` comments.
- **State key consistency:** Use PascalCase state names as keys (e.g., `Maharashtra`, `WestBengal`, `AndhraPradesh`, `TamilNadu`, `UttarPradesh`). Ensure the Company Setup dropdown values match these exactly.
- **Commit convention:** `feat(compliance): Phase N — description` after each phase passes tests.
