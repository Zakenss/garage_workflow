-- Priority order for mechanic work queue (set by workshop manager)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS dispatch_priority SMALLINT;

ALTER TABLE mechanic_assignments
  ADD COLUMN IF NOT EXISTS priority_order SMALLINT;

CREATE INDEX IF NOT EXISTS idx_vehicles_dispatch_priority
  ON vehicles (assigned_mechanic_id, dispatch_priority)
  WHERE dispatch_priority IS NOT NULL;
