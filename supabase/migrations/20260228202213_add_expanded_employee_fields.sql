-- Add expanded fields for bulk employee upload
ALTER TABLE "public"."employees" 
ADD COLUMN IF NOT EXISTS "gender" text,
ADD COLUMN IF NOT EXISTS "dob" date,
ADD COLUMN IF NOT EXISTS "bank_account" text,
ADD COLUMN IF NOT EXISTS "ifsc" text,
ADD COLUMN IF NOT EXISTS "payment_mode" text;
