-- Parts list approval, reception tracking, ready-for-mechanic, repair scheduling

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS parts_list_status TEXT CHECK (
    parts_list_status IS NULL OR parts_list_status IN (
      'draft', 'pending_approval', 'approved', 'rejected'
    )
  ),
  ADD COLUMN IF NOT EXISTS parts_list_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parts_list_submitted_by UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS parts_list_reviewed_by UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS parts_list_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parts_list_rejection_comment TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_repair_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_by UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS parts_ready_notified_at TIMESTAMPTZ;

ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS quantity_received INTEGER NOT NULL DEFAULT 0;

ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_status_check;

ALTER TABLE parts
  ADD CONSTRAINT parts_status_check CHECK (
    status IN (
      'in_stock',
      'to_order',
      'ordered',
      'to_repair',
      'received',
      'ready_for_mechanic'
    )
  );

CREATE INDEX IF NOT EXISTS idx_vehicles_parts_list_status
  ON vehicles (parts_list_status)
  WHERE parts_list_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_scheduled_repair
  ON vehicles (scheduled_repair_at)
  WHERE scheduled_repair_at IS NOT NULL;
