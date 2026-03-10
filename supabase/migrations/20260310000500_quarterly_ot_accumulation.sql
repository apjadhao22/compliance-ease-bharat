-- ============================================================
-- Quarterly Overtime Accumulation Tracking
-- OSH Code 2020 caps overtime at 115 hours per quarter
-- Updated by compute-violations Edge Function
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quarterly_ot_accumulation (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    quarter_start  DATE NOT NULL,          -- e.g. 2026-01-01, 2026-04-01
    total_ot_hours NUMERIC(10,2) DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, employee_id, quarter_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qot_company_id ON public.quarterly_ot_accumulation(company_id);
CREATE INDEX IF NOT EXISTS idx_qot_employee_id ON public.quarterly_ot_accumulation(employee_id);
CREATE INDEX IF NOT EXISTS idx_qot_quarter ON public.quarterly_ot_accumulation(company_id, quarter_start);

-- RLS
ALTER TABLE public.quarterly_ot_accumulation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company quarterly_ot_accumulation"
ON public.quarterly_ot_accumulation
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
