-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('vehicle-photos', 'vehicle-photos', true),
  ('diagnostic-photos', 'diagnostic-photos', true),
  ('bodywork-photos', 'bodywork-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policies (internal app without Supabase Auth)
CREATE POLICY "Public read vehicle photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Public upload vehicle photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "Public read diagnostic photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'diagnostic-photos');

CREATE POLICY "Public upload diagnostic photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'diagnostic-photos');

CREATE POLICY "Public read bodywork photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bodywork-photos');

CREATE POLICY "Public upload bodywork photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bodywork-photos');
