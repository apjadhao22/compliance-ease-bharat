
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS compliance_regime TEXT DEFAULT 'legacy_acts';

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'permanent';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS da DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS retaining_allowance DECIMAL(10,2) DEFAULT 0;
