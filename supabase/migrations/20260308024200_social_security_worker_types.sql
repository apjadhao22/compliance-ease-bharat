-- Migration: Add Social Security Code specific fields for gig/platform mapping
-- Phase: 1B

-- 1. Extend Companies / Organisations with aggregator status
ALTER TABLE public.companies
ADD COLUMN is_aggregator boolean DEFAULT false,
ADD COLUMN social_security_registration_id text;

-- 2. Map distinct worker types to Employees table (unorganised/gig concepts)
ALTER TABLE public.employees
ADD COLUMN worker_type text DEFAULT 'employee',
ADD COLUMN social_security_portal_registered boolean DEFAULT false,
ADD COLUMN nduw_eshram_id text, -- e-Shram or national database ID
ADD COLUMN ssp_last_verified_at timestamp with time zone;

-- Enforce valid worker types under Social Security Code
ALTER TABLE public.employees
ADD CONSTRAINT chk_worker_type CHECK (worker_type IN ('employee', 'contract', 'fixed_term', 'gig', 'platform', 'unorganised'));
