-- Supplier and unit price for parts costing
ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS supplier TEXT,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2);
