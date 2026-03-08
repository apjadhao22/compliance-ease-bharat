-- Migration: Add State Shops & Establishments (S&E) tables (Phase 4)

-- 1. S&E Registrations (State level tracking, e.g., Form A/B/C)
CREATE TABLE IF NOT EXISTS public.se_registrations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    state text NOT NULL, -- e.g., "Maharashtra", "Karnataka", "Delhi"
    registration_number text,
    registration_date date,
    valid_until date,
    establishment_category text, -- e.g., "Commercial Establishment", "IT/ITES", "Shop"
    total_employees integer DEFAULT 0,
    address text,
    documents jsonb DEFAULT '[]', -- References to uploaded certificates
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(company_id, state, registration_number)
);

-- Enable RLS
ALTER TABLE public.se_registrations ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can manage their own se_registrations" 
ON public.se_registrations FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
