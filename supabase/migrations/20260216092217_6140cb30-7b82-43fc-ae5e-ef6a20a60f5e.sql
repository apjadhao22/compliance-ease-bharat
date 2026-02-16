
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  working_days INTEGER DEFAULT 26,
  days_present INTEGER NOT NULL,
  paid_leaves INTEGER DEFAULT 0,
  unpaid_leaves INTEGER DEFAULT 0,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  daily_marks TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own attendance" ON public.attendance
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE INDEX idx_attendance_company_month ON public.attendance(company_id, month);
