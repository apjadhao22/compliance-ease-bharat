-- ============================================================
-- Working Hour Violations Table
-- Stores server-side detected OSH & S&E working hour violations
-- Populated by compute-violations Edge Function
-- ============================================================

CREATE TABLE IF NOT EXISTS public.working_hour_violations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    violation_date   DATE NOT NULL,
    violation_type   TEXT NOT NULL,       -- 'daily_hours','weekly_hours','spread_over','quarterly_ot','continuous_hours','rest_interval','night_shift_no_consent'
    rule_source      TEXT NOT NULL,       -- 'OSH' or 'SE'
    state            TEXT,
    limit_value      NUMERIC(10,2),
    actual_value     NUMERIC(10,2),
    issue_description TEXT,
    week_start_date  DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whv_company_id ON public.working_hour_violations(company_id);
CREATE INDEX IF NOT EXISTS idx_whv_employee_id ON public.working_hour_violations(employee_id);
CREATE INDEX IF NOT EXISTS idx_whv_company_rule ON public.working_hour_violations(company_id, rule_source);
CREATE INDEX IF NOT EXISTS idx_whv_violation_date ON public.working_hour_violations(violation_date);

-- RLS
ALTER TABLE public.working_hour_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company working_hour_violations"
ON public.working_hour_violations
FOR ALL
USING (
    company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
);
