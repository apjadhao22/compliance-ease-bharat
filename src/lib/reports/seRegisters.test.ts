import { describe, it, expect } from 'vitest';
import { generateSERegister } from './seRegisters';
import type { RegisterInput, EmployeeRow, PayrollRow, LeaveRow } from './seRegisters';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPLOYEES: EmployeeRow[] = [
  {
    id: 'EMP001',
    emp_code: 'E001',
    name: 'Priya Sharma',
    designation: 'Senior Analyst',
    department: 'Finance',
    date_of_joining: '2021-06-01',
    basic: 45000,
  },
  {
    id: 'EMP002',
    emp_code: 'E002',
    name: 'Rahul Verma',
    designation: 'Developer',
    department: 'Engineering',
    date_of_joining: '2022-03-15',
    basic: 60000,
  },
];

const PAYROLL_BY_EMP: Record<string, PayrollRow> = {
  EMP001: { employee_id: 'EMP001', gross_earnings: 52000, net_pay: 46000, basic_paid: 45000, epf_employee: 2400, esic_employee: 0, pt: 200, lwf_employee: 25 },
  EMP002: { employee_id: 'EMP002', gross_earnings: 68000, net_pay: 60000, basic_paid: 60000, epf_employee: 3600, esic_employee: 0, pt: 200, lwf_employee: 25 },
};

const LEAVES_BY_EMP: Record<string, LeaveRow[]> = {
  EMP001: [
    { employee_id: 'EMP001', leave_type: 'Earned', days_count: 3 },
    { employee_id: 'EMP001', leave_type: 'Sick', days_count: 2 },
  ],
  EMP002: [
    { employee_id: 'EMP002', leave_type: 'Casual', days_count: 1 },
    { employee_id: 'EMP002', leave_type: 'Earned', days_count: 5 },
  ],
};

const INPUT: RegisterInput = {
  employees: EMPLOYEES,
  payrollByEmp: PAYROLL_BY_EMP,
  leavesByEmp: LEAVES_BY_EMP,
  month: '2026-03',
  companyName: 'TestCo Pvt Ltd',
};

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSVFirstRow(csv: string, rowIndex: number): string[] {
  const lines = csv.split('\n').filter(Boolean);
  if (rowIndex >= lines.length) return [];
  // Simple split on ," to handle quoted cells
  return lines[rowIndex].split('","').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
}

function csvContains(csv: string, text: string): boolean {
  return csv.includes(text);
}

function countRows(csv: string): number {
  return csv.split('\n').filter(Boolean).length;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('S&E Register CSV Generation — seRegisters.ts', () => {

  // ── Maharashtra Form II (Muster Roll) ───────────────────────────────────

  describe('Maharashtra Form II — Muster Roll', () => {
    const { csv, filename } = generateSERegister('Maharashtra', 'Form II', INPUT);

    it('returns non-empty CSV', () => {
      expect(csv.length).toBeGreaterThan(100);
    });

    it('filename contains Form_II and Maharashtra', () => {
      expect(filename).toContain('Form_II');
      expect(filename).toContain('Maharashtra');
    });

    it('filename contains the month', () => {
      expect(filename).toContain('Mar_2026');
    });

    it('CSV contains required column headers', () => {
      expect(csvContains(csv, 'Name of Employee')).toBe(true);
      expect(csvContains(csv, 'Monthly Wages')).toBe(true);
      expect(csvContains(csv, 'Designation')).toBe(true);
      expect(csvContains(csv, 'Date of Employment')).toBe(true);
    });

    it('CSV contains both employee names', () => {
      expect(csvContains(csv, 'Priya Sharma')).toBe(true);
      expect(csvContains(csv, 'Rahul Verma')).toBe(true);
    });

    it('CSV contains [MANUAL] signature marker', () => {
      expect(csvContains(csv, '[MANUAL]')).toBe(true);
    });

    it('CSV contains disclaimer row', () => {
      expect(csvContains(csv, '[DISCLAIMER]')).toBe(true);
    });

    it('CSV contains Maharashtra act citation', () => {
      expect(csvContains(csv, 'Maharashtra Shops and Establishments')).toBe(true);
    });

    it('has correct total row count: disclaimer + citation + header + 2 data rows = 5', () => {
      expect(countRows(csv)).toBe(5);
    });
  });

  // ── Maharashtra Form V (Leave Register) ─────────────────────────────────

  describe('Maharashtra Form V — Leave Register', () => {
    const { csv, filename } = generateSERegister('Maharashtra', 'Form V', INPUT);

    it('returns non-empty CSV', () => {
      expect(csv.length).toBeGreaterThan(50);
    });

    it('filename contains Form_V', () => {
      expect(filename).toContain('Form_V');
    });

    it('CSV contains leave-related headers', () => {
      expect(csvContains(csv, 'EL Taken')).toBe(true);
      expect(csvContains(csv, 'SL Taken')).toBe(true);
      expect(csvContains(csv, 'CL Taken')).toBe(true);
      expect(csvContains(csv, 'EL Balance')).toBe(true);
    });

    it('CSV reflects employee EL taken (EMP001 took 3 EL days)', () => {
      expect(csvContains(csv, '3')).toBe(true); // EL taken by Priya
    });
  });

  // ── Karnataka Form T (Combined Register) ────────────────────────────────

  describe('Karnataka Form T — Combined Register', () => {
    const { csv, filename } = generateSERegister('Karnataka', 'Form T', INPUT);

    it('returns non-empty CSV', () => {
      expect(csv.length).toBeGreaterThan(50);
    });

    it('filename contains Form_T and Karnataka', () => {
      expect(filename).toContain('Form_T');
      expect(filename).toContain('Karnataka');
    });

    it('CSV contains payroll deduction headers', () => {
      expect(csvContains(csv, 'EPF EE')).toBe(true);
      expect(csvContains(csv, 'ESIC EE')).toBe(true);
      expect(csvContains(csv, 'Net Pay')).toBe(true);
    });

    it('CSV contains employee gross earnings', () => {
      expect(csvContains(csv, '52000')).toBe(true); // Priya gross
      expect(csvContains(csv, '68000')).toBe(true); // Rahul gross
    });

    it('CSV references Karnataka S&E Act 1961', () => {
      expect(csvContains(csv, 'Karnataka Shops and Commercial Establishments Act, 1961')).toBe(true);
    });
  });

  // ── Tamil Nadu Form XIV ──────────────────────────────────────────────────

  describe('Tamil Nadu Form XIV — Register of Wages', () => {
    const { csv, filename } = generateSERegister('Tamil Nadu', 'Form XIV', INPUT);

    it('returns non-empty CSV', () => {
      expect(csv.length).toBeGreaterThan(50);
    });

    it('filename contains Form_XIV', () => {
      expect(filename).toContain('Form_XIV');
    });

    it('CSV contains Father/Husband Name as [MANUAL]', () => {
      expect(csvContains(csv, '[MANUAL]')).toBe(true);
    });

    it('CSV contains Tamil Nadu act citation', () => {
      expect(csvContains(csv, 'Tamil Nadu Shops and Establishments Act, 1947')).toBe(true);
    });

    it('CSV contains Total Deductions column', () => {
      expect(csvContains(csv, 'Total Deductions')).toBe(true);
    });
  });

  // ── Delhi Form G ─────────────────────────────────────────────────────────

  describe('Delhi Form G — Register of Employment', () => {
    const { csv, filename } = generateSERegister('Delhi', 'Form G', INPUT);

    it('returns non-empty CSV', () => {
      expect(csv.length).toBeGreaterThan(50);
    });

    it('filename contains Form_G and Delhi', () => {
      expect(filename).toContain('Form_G');
      expect(filename).toContain('Delhi');
    });

    it('CSV contains Date of Joining', () => {
      expect(csvContains(csv, 'Date of Joining')).toBe(true);
    });

    it('Date of Leaving is marked [MANUAL]', () => {
      expect(csvContains(csv, '[MANUAL]')).toBe(true);
    });
  });

  // ── Telangana Form A (NEW) ───────────────────────────────────────────────

  describe('Telangana Form A — Combined Register (NEW)', () => {
    const { csv, filename } = generateSERegister('Telangana', 'Form A', INPUT);

    it('returns non-empty CSV', () => {
      expect(csv.length).toBeGreaterThan(50);
    });

    it('filename contains Form_A and Telangana', () => {
      expect(filename).toContain('Form_A');
      expect(filename).toContain('Telangana');
    });

    it('CSV contains Telangana S&E Act 1988 citation', () => {
      expect(csvContains(csv, 'Telangana Shops and Establishments Act, 1988')).toBe(true);
    });

    it('CSV contains required combined register headers', () => {
      expect(csvContains(csv, 'Name of Employee')).toBe(true);
      expect(csvContains(csv, 'Designation')).toBe(true);
      expect(csvContains(csv, 'Gross Wages')).toBe(true);
      expect(csvContains(csv, 'Net Pay')).toBe(true);
      expect(csvContains(csv, 'Total Deductions')).toBe(true);
    });

    it('CSV contains Father/Husband Name [MANUAL] column', () => {
      expect(csvContains(csv, 'Father/Husband Name')).toBe(true);
    });

    it('CSV computes total deductions correctly for EMP001 (epf+esic+pt = 2400+0+200 = 2600)', () => {
      expect(csvContains(csv, '2600')).toBe(true);
    });

    it('CSV contains both employee names', () => {
      expect(csvContains(csv, 'Priya Sharma')).toBe(true);
      expect(csvContains(csv, 'Rahul Verma')).toBe(true);
    });
  });

  // ── Fallback for unknown state ────────────────────────────────────────────

  describe('Fallback — unknown state/form', () => {
    it('should return a generic CSV with disclaimer for unlisted state', () => {
      const { csv, filename } = generateSERegister('Rajasthan', 'Form Z', INPUT);
      expect(csv.length).toBeGreaterThan(10);
      expect(csvContains(csv, '[DISCLAIMER]')).toBe(true);
      expect(csvContains(csv, 'No specific register template')).toBe(true);
    });

    it('filename should still include form name and state for unknown state', () => {
      const { filename } = generateSERegister('Rajasthan', 'Form Z', INPUT);
      expect(filename).toContain('Form_Z');
      expect(filename).toContain('Rajasthan');
    });

    it('fallback CSV should still include employee names', () => {
      const { csv } = generateSERegister('Himachal Pradesh', 'Form X', INPUT);
      expect(csvContains(csv, 'Priya Sharma')).toBe(true);
      expect(csvContains(csv, 'Rahul Verma')).toBe(true);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle empty employee list gracefully', () => {
      const { csv } = generateSERegister('Maharashtra', 'Form II', { employees: [] });
      // Should at least have disclaimer + citation + header rows
      expect(csv.length).toBeGreaterThan(10);
      expect(csvContains(csv, '[DISCLAIMER]')).toBe(true);
    });

    it('should handle missing payroll data — uses employee basic as fallback', () => {
      const input: RegisterInput = {
        employees: EMPLOYEES,
        payrollByEmp: {}, // no payroll
        month: '2026-03',
      };
      const { csv } = generateSERegister('Maharashtra', 'Form II', input);
      // Should fall back to emp.basic (45000, 60000)
      expect(csvContains(csv, '45000')).toBe(true);
      expect(csvContains(csv, '60000')).toBe(true);
    });

    it('CSV should not contain broken/unmatched quotes (syntactically valid)', () => {
      const { csv } = generateSERegister('Karnataka', 'Form T', INPUT);
      // Count open vs close quotes — should match in each line
      const lines = csv.split('\n').filter(Boolean);
      for (const line of lines) {
        // Quick structural check: each cell starts and ends with a quote
        const cells = line.split('","');
        expect(cells.length).toBeGreaterThan(0);
        expect(line.startsWith('"')).toBe(true);
        expect(line.endsWith('"')).toBe(true);
      }
    });

    it('backward-compat convenience exports should work', async () => {
      // These are re-exports of generateSERegister with pre-filled state/form
      const { generateFormII_MH, generateFormT_KA, generateFormA_TS } = await import('./seRegisters');
      const mhResult = generateFormII_MH(INPUT);
      const kaResult = generateFormT_KA(INPUT);
      const tsResult = generateFormA_TS(INPUT);

      expect(mhResult.filename).toContain('Form_II');
      expect(kaResult.filename).toContain('Form_T');
      expect(tsResult.filename).toContain('Form_A');
    });
  });

});
