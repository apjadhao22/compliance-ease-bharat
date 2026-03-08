-- Migration: Add Industrial Relations Code tables (Phase 3)
-- Standing Orders, Grievance Committees, Employment Events (Layoffs)

-- 1. Standing Orders (IR Code, 2020 - Chapter IV)
CREATE TABLE IF NOT EXISTS public.standing_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    order_type text NOT NULL, -- "model" or "custom"
    status text NOT NULL DEFAULT 'draft', -- "draft", "submitted", "approved"
    effective_from date,
    effective_to date,
    approval_authority text,
    document_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Grievance Redressal Committees (IR Code, Chapter II, Section 4)
CREATE TABLE IF NOT EXISTS public.grievance_committees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    members jsonb DEFAULT '[]', -- Array of { name, role, is_employee_rep: boolean }
    remarks text,
    last_reviewed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Grievances (Linked to Committee)
CREATE TABLE IF NOT EXISTS public.grievances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    committee_id uuid REFERENCES public.grievance_committees(id) ON DELETE SET NULL,
    description text NOT NULL,
    raised_at timestamp with time zone DEFAULT now(),
    status text NOT NULL DEFAULT 'open', -- "open", "in_review", "resolved", "appealed"
    resolution_summary text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 4. IR Employment Events (Layoffs, Retrenchment, Closure - IR Code Chapters IX & X)
CREATE TABLE IF NOT EXISTS public.ir_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    event_type text NOT NULL, -- "layoff", "retrenchment", "closure"
    event_date date NOT NULL,
    affected_workers_count integer DEFAULT 0,
    authority_notified boolean DEFAULT false,
    notice_date date,
    compensation_summary text,
    documents jsonb DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Link FnF settlements to an IR event trigger
ALTER TABLE public.fnf_settlements
ADD COLUMN ir_event_id uuid REFERENCES public.ir_events(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.standing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievance_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ir_events ENABLE ROW LEVEL SECURITY;

-- Add standard RLS policies
CREATE POLICY "Users can manage their own standing orders" 
ON public.standing_orders FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own grievance committees" 
ON public.grievance_committees FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own grievances" 
ON public.grievances FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own IR events" 
ON public.ir_events FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
