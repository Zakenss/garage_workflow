-- Reconditioning checklist stored on diagnostics
ALTER TABLE diagnostics
  ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT NULL;
