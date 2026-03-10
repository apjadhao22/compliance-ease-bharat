-- ============================================================
-- Night Shift Consent Sync
-- Ensures night_shift_consents table and employees.night_shift_consent
-- stay in sync via database triggers
-- ============================================================

-- 1. Add unique constraint to prevent duplicate consent records per employee per company
ALTER TABLE public.night_shift_consents
ADD CONSTRAINT uq_night_shift_consents_company_employee
UNIQUE (company_id, employee_id);

-- 2. Trigger: When night_shift_consents is inserted/updated, sync to employees.night_shift_consent
CREATE OR REPLACE FUNCTION sync_consent_to_employee()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.employees
    SET night_shift_consent = NEW.consent_given,
        night_shift_consent_date = NEW.consent_date
    WHERE id = NEW.employee_id
      AND company_id = NEW.company_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_consent_to_employee
    AFTER INSERT OR UPDATE ON public.night_shift_consents
    FOR EACH ROW EXECUTE FUNCTION sync_consent_to_employee();

-- 3. Trigger: When employees.night_shift_consent is toggled, upsert into night_shift_consents
CREATE OR REPLACE FUNCTION sync_employee_to_consent()
RETURNS TRIGGER AS $$
BEGIN
    -- Only fire when night_shift_consent actually changes
    IF OLD.night_shift_consent IS DISTINCT FROM NEW.night_shift_consent THEN
        INSERT INTO public.night_shift_consents (company_id, employee_id, consent_given, consent_date, valid_until)
        VALUES (
            NEW.company_id,
            NEW.id,
            NEW.night_shift_consent,
            COALESCE(NEW.night_shift_consent_date, CURRENT_DATE),
            CURRENT_DATE + INTERVAL '6 months'
        )
        ON CONFLICT (company_id, employee_id)
        DO UPDATE SET
            consent_given = EXCLUDED.consent_given,
            consent_date = EXCLUDED.consent_date,
            valid_until = EXCLUDED.valid_until,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_employee_to_consent
    AFTER UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION sync_employee_to_consent();
