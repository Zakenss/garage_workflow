-- RLS for tables added after 004_realtime (match anon app access pattern)

ALTER TABLE mechanic_reported_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE storekeeper_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all mechanic_reported_issues"
  ON mechanic_reported_issues FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all storekeeper_checklists"
  ON storekeeper_checklists FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE mechanic_reported_issues;
