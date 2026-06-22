-- Part status: à réparer (replace or bodywork) + link bodywork jobs to a part
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_status_check;

ALTER TABLE parts
  ADD CONSTRAINT parts_status_check CHECK (
    status IN ('in_stock', 'to_order', 'ordered', 'to_repair', 'received')
  );

ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS repair_action TEXT CHECK (
    repair_action IS NULL OR repair_action IN ('replace', 'bodywork')
  );

ALTER TABLE bodywork
  ADD COLUMN IF NOT EXISTS source_part_id UUID REFERENCES parts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bodywork_source_part ON bodywork (source_part_id);
