-- Storekeeper checklist per vehicle
CREATE TABLE IF NOT EXISTS storekeeper_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL UNIQUE REFERENCES vehicles (id) ON DELETE CASCADE,
  checklist_data JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storekeeper_checklists_vehicle
  ON storekeeper_checklists (vehicle_id);

CREATE TRIGGER storekeeper_checklists_updated_at
  BEFORE UPDATE ON storekeeper_checklists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
