-- Add RLS to leave_requests if it doesn't have it
-- Note: Supabase will ignore the ENABLE ROW LEVEL SECURITY command if it's already enabled, making this safe.
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'Pending',
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own company leave requests" ON public.leave_requests;
CREATE POLICY "Users access own company leave requests" ON public.leave_requests
    FOR ALL USING (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    );

-- Add RLS to expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own company expenses" ON public.expenses;
CREATE POLICY "Users access own company expenses" ON public.expenses
    FOR ALL USING (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    );

-- Add RLS to assets
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    serial_number TEXT,
    issue_date DATE,
    return_date DATE,
    status TEXT DEFAULT 'Assigned',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own company assets" ON public.assets;
CREATE POLICY "Users access own company assets" ON public.assets
    FOR ALL USING (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    );

-- Add RLS to fnf_settlements
CREATE TABLE IF NOT EXISTS public.fnf_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL,
    notice_period_days INTEGER DEFAULT 0,
    notice_pay_deduction DECIMAL(10,2) DEFAULT 0,
    leave_encashment_days INTEGER DEFAULT 0,
    leave_encashment_amount DECIMAL(10,2) DEFAULT 0,
    gratuity_amount DECIMAL(10,2) DEFAULT 0,
    bonus_amount DECIMAL(10,2) DEFAULT 0,
    pending_salary DECIMAL(10,2) DEFAULT 0,
    other_additions DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,
    net_payable DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, employee_id)
);

ALTER TABLE public.fnf_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own company fnf settlements" ON public.fnf_settlements;
CREATE POLICY "Users access own company fnf settlements" ON public.fnf_settlements
    FOR ALL USING (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    );
