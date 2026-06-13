-- Track manual repair start/finish on mechanic reported issues (follow-up work)
ALTER TABLE mechanic_reported_issues
  ADD COLUMN IF NOT EXISTS repair_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS repair_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mechanic_issues_repair_active
  ON mechanic_reported_issues (vehicle_id)
  WHERE repair_started_at IS NOT NULL AND repair_completed_at IS NULL;
