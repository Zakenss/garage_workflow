-- Vehicle documents (repair cost reports), Google Calendar event id, workshop settings

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS seller_expert_calendar_event_id TEXT;

CREATE TABLE IF NOT EXISTS workshop_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO workshop_settings (key, value)
VALUES ('labour_hourly_rate', '55')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('repair_cost_report')),
  storage_path TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES users (id),
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE (vehicle_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle
  ON vehicle_documents (vehicle_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read vehicle documents" ON storage.objects;
CREATE POLICY "Public read vehicle documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "Public upload vehicle documents" ON storage.objects;
CREATE POLICY "Public upload vehicle documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-documents');

ALTER TABLE workshop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all workshop_settings" ON workshop_settings;
CREATE POLICY "Allow all workshop_settings" ON workshop_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all vehicle_documents" ON vehicle_documents;
CREATE POLICY "Allow all vehicle_documents" ON vehicle_documents FOR ALL USING (true) WITH CHECK (true);
