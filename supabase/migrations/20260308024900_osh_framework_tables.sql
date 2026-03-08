-- Migration: Add OSH Code tables for registrations, licences, safety committees, medical checkups and night shifts
-- Phase: 2

-- 1. OSH Registrations (Code on OSH & WC, 2020 - Section 3)
CREATE TABLE IF NOT EXISTS public.osh_registrations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    establishment_type text NOT NULL, -- e.g. Factory, Mine, Beedi/Cigar, Building worker
    registration_number text NOT NULL,
    registration_date date,
    valid_until date,
    state text,
    documents jsonb DEFAULT '[]', -- Array of { fileName, url }
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. OSH Licenses (For contractors/factories under Section 47)
CREATE TABLE IF NOT EXISTS public.osh_licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    license_type text NOT NULL, -- e.g. Contractor License, Factory License
    license_number text NOT NULL,
    issue_date date,
    valid_until date,
    state text,
    renewal_status text DEFAULT 'Valid', -- Valid, Expired, Renewal Pending
    documents jsonb DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Safety Committees (OSH Code, Section 22)
CREATE TABLE IF NOT EXISTS public.safety_committees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    members text[] DEFAULT '{}',
    roles jsonb DEFAULT '{}', -- Map of member -> role
    meeting_frequency text DEFAULT 'Quarterly',
    last_meeting_date date,
    minutes_documents jsonb DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 4. Medical Checkups (OSH Code, Section 6(1)(c) / Section 23)
CREATE TABLE IF NOT EXISTS public.medical_checkups (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    checkup_date date NOT NULL,
    type text NOT NULL, -- e.g. Pre-employment, Annual, Hazardous Process Specific
    findings_summary text,
    next_due_date date,
    clinic_details text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. Women Night Work Config on Employees (OSH Code, Section 43)
ALTER TABLE public.employees
ADD COLUMN gender text,
ADD COLUMN night_shift_consent boolean DEFAULT false,
ADD COLUMN night_shift_consent_date date;

-- Enable RLS logic for new tables
ALTER TABLE public.osh_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osh_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_checkups ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policies
CREATE POLICY "Users can manage their own OSH registrations" 
ON public.osh_registrations FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own OSH licenses" 
ON public.osh_licenses FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own safety committees" 
ON public.safety_committees FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- Policy for medical checkups requires joining employees -> companies
CREATE POLICY "Users can manage medical checkups for their employees"
ON public.medical_checkups FOR ALL
USING (employee_id IN (
  SELECT e.id FROM public.employees e 
  JOIN public.companies c ON e.company_id = c.id 
  WHERE c.user_id = auth.uid()
));
