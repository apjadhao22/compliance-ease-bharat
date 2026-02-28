-- timesheets table for Phase 3 ingestion (Compliance Upgrades)
CREATE TABLE IF NOT EXISTS public.timesheets (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    normal_hours numeric(5,2) NOT NULL DEFAULT 8.00,
    overtime_hours numeric(5,2) NOT NULL DEFAULT 0.00,
    status text NOT NULL DEFAULT 'Pending'::text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_timesheets_company_id ON public.timesheets USING btree (company_id);
CREATE INDEX idx_timesheets_employee_id ON public.timesheets USING btree (employee_id);
CREATE INDEX idx_timesheets_date ON public.timesheets USING btree (date);

-- constraints
ALTER TABLE ONLY public.timesheets ADD CONSTRAINT timesheets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.timesheets ADD CONSTRAINT timesheets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timesheets ADD CONSTRAINT timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for users based on company_id" ON public.timesheets FOR ALL USING (
    (company_id IN ( SELECT companies.id FROM public.companies WHERE (companies.user_id = auth.uid()) ))
) WITH CHECK (
    (company_id IN ( SELECT companies.id FROM public.companies WHERE (companies.user_id = auth.uid()) ))
);
