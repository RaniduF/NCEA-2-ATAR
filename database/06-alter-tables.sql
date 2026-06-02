ALTER TABLE standards ALTER COLUMN is_ue DROP DEFAULT;
ALTER TABLE standards ALTER COLUMN is_ue TYPE BOOLEAN USING (is_ue = 1);
ALTER TABLE standards ALTER COLUMN is_ue SET DEFAULT FALSE;

-- Widen weight columns from DECIMAL(20,15) to DOUBLE PRECISION so that
-- NZQA's full ~17-digit float64 weights round-trip exactly. The 15-digit
-- decimal cap was causing ~1e-10 drift in computed statistical values
-- (sufficient to shift rank by 1 in dense parts of the distribution).
ALTER TABLE standard_weightings ALTER COLUMN weight_not_achieved TYPE DOUBLE PRECISION;
ALTER TABLE standard_weightings ALTER COLUMN weight_achieved     TYPE DOUBLE PRECISION;
ALTER TABLE standard_weightings ALTER COLUMN weight_merit        TYPE DOUBLE PRECISION;
ALTER TABLE standard_weightings ALTER COLUMN weight_excellence   TYPE DOUBLE PRECISION;
