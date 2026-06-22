-- Mechanic classifies each reported problem as mechanical or bodywork (for storekeeper routing)
ALTER TABLE mechanic_reported_issues
  ADD COLUMN IF NOT EXISTS problem_category TEXT CHECK (
    problem_category IS NULL OR problem_category IN ('mechanical', 'bodywork')
  );

CREATE INDEX IF NOT EXISTS idx_mechanic_issues_category
  ON mechanic_reported_issues (problem_category);
