-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE mechanic_assignments;

-- Allow anon access for internal app (no Supabase Auth)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vei_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodywork ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodywork_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vehicle_photos" ON vehicle_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vei_cases" ON vei_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mechanic_assignments" ON mechanic_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all diagnostics" ON diagnostics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all diagnostic_photos" ON diagnostic_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all diagnostic_quotes" ON diagnostic_quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all parts" ON parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all part_orders" ON part_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all validation_items" ON validation_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all repairs" ON repairs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all bodywork" ON bodywork FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all bodywork_photos" ON bodywork_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all final_checklists" ON final_checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vehicle_timeline" ON vehicle_timeline FOR ALL USING (true) WITH CHECK (true);
