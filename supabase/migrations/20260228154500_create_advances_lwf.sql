-- Create LWF Remittances table
CREATE TABLE public.lwf_remittances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    remittance_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_employees INTEGER DEFAULT 0,
    employee_contribution NUMERIC DEFAULT 0,
    employer_contribution NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Failed')),
    transaction_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for lwf_remittances
ALTER TABLE public.lwf_remittances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their companies' lwf records"
    ON public.lwf_remittances FOR SELECT
    USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their companies' lwf records"
    ON public.lwf_remittances FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their companies' lwf records"
    ON public.lwf_remittances FOR UPDATE
    USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their companies' lwf records"
    ON public.lwf_remittances FOR DELETE
    USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

-- Create Employee Advances table
CREATE TABLE public.employee_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    purpose TEXT,
    instalment_count INTEGER NOT NULL DEFAULT 1,
    repaid_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for employee_advances
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their companies' advances"
    ON public.employee_advances FOR SELECT
    USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their companies' advances"
    ON public.employee_advances FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their companies' advances"
    ON public.employee_advances FOR UPDATE
    USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their companies' advances"
    ON public.employee_advances FOR DELETE
    USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );
