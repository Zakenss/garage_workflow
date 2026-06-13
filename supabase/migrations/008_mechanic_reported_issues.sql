-- Mechanic reported problems with manager validation workflow
CREATE TABLE IF NOT EXISTS mechanic_reported_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES users (id),
  source TEXT NOT NULL DEFAULT 'checklist' CHECK (source IN ('checklist', 'followup')),
  checklist_item_id TEXT,
  checklist_label TEXT,
  problem TEXT NOT NULL,
  parts_needed TEXT NOT NULL,
  photo_paths JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending_manager' CHECK (status IN (
    'pending_manager', 'approved', 'rejected'
  )),
  validated_by UUID REFERENCES users (id),
  validated_at TIMESTAMPTZ,
  part_id UUID REFERENCES parts (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mechanic_issues_vehicle ON mechanic_reported_issues (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_issues_status ON mechanic_reported_issues (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mechanic_issues_checklist_item
  ON mechanic_reported_issues (vehicle_id, checklist_item_id)
  WHERE checklist_item_id IS NOT NULL;

CREATE TRIGGER mechanic_reported_issues_updated_at
  BEFORE UPDATE ON mechanic_reported_issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE storekeeper_checklists
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users (id);
