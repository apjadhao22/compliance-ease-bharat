-- ============================================================
-- Gap 6: Per-shift Women Night Work Consent Records
-- OSH Code 2020, Chapter X, Section 43
-- ============================================================

CREATE TABLE IF NOT EXISTS night_shift_consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_policy_id UUID REFERENCES shift_policies(id) ON DELETE SET NULL,
    consent_given   BOOLEAN NOT NULL DEFAULT FALSE,
    consent_date    DATE,
    valid_until     DATE,
    safeguards_documented BOOLEAN NOT NULL DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_night_shift_consents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_night_shift_consents_updated_at
    BEFORE UPDATE ON night_shift_consents
    FOR EACH ROW EXECUTE FUNCTION update_night_shift_consents_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_night_shift_consents_company_id  ON night_shift_consents(company_id);
CREATE INDEX IF NOT EXISTS idx_night_shift_consents_employee_id ON night_shift_consents(employee_id);
CREATE INDEX IF NOT EXISTS idx_night_shift_consents_valid_until  ON night_shift_consents(valid_until);

-- RLS
ALTER TABLE night_shift_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company night_shift_consents"
ON night_shift_consents
FOR ALL
USING (
    company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
    )
);
