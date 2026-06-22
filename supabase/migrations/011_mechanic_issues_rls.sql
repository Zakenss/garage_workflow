-- RLS for tables added after 004_realtime (match anon app access pattern)
-- Idempotent: safe to re-run if policies/publication already exist.

ALTER TABLE mechanic_reported_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE storekeeper_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all mechanic_reported_issues" ON mechanic_reported_issues;
CREATE POLICY "Allow all mechanic_reported_issues"
  ON mechanic_reported_issues FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all storekeeper_checklists" ON storekeeper_checklists;
CREATE POLICY "Allow all storekeeper_checklists"
  ON storekeeper_checklists FOR ALL USING (true) WITH CHECK (true);

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mechanic_reported_issues'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mechanic_reported_issues;
  END IF;
END
$do$;
