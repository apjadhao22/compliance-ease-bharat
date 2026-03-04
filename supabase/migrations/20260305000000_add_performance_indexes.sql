-- Performance indexes for scaling to 1 lakh+ employees
-- These composite indexes cover the hot query paths across all dashboard pages

-- Core employee lookups (Employees, Payroll, BonusGratuity, Overview, etc.)
CREATE INDEX IF NOT EXISTS idx_employees_company_status
  ON public.employees(company_id, status);

-- Payroll detail lookups (EPF/ESIC, Registers, Reports)
CREATE INDEX IF NOT EXISTS idx_payroll_details_run_id
  ON public.payroll_details(payroll_run_id);

-- Leave request filtering (Payroll processing, Overview)
CREATE INDEX IF NOT EXISTS idx_leave_requests_company_status
  ON public.leave_requests(company_id, status);

-- Bulk upload conflict resolution (EmployeeBulkUpload, FormIIUpload)
CREATE INDEX IF NOT EXISTS idx_employees_company_empcode
  ON public.employees(company_id, emp_code);

-- Payroll run month lookups (Payroll, Registers)
CREATE INDEX IF NOT EXISTS idx_payroll_runs_company_month
  ON public.payroll_runs(company_id, month);

-- Expense filtering for payroll processing
CREATE INDEX IF NOT EXISTS idx_expenses_company_status_date
  ON public.expenses(company_id, status, date);

-- FnF settlement lookups
CREATE INDEX IF NOT EXISTS idx_fnf_company_status
  ON public.fnf_settlements(company_id, status);

-- Timesheet date range queries (Timesheets, Registers muster roll)
CREATE INDEX IF NOT EXISTS idx_timesheets_company_date
  ON public.timesheets(company_id, date);

-- Employee name search (server-side ilike search)
CREATE INDEX IF NOT EXISTS idx_employees_company_name_trgm
  ON public.employees(company_id, name);
