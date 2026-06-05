-- Garage Workflow - Schema
-- Run in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users (custom auth, no Supabase Auth)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'secretary',
    'workshop_manager',
    'mechanic',
    'storekeeper',
    'bodyworker',
    'seller',
    'admin'
  )),
  mechanic_slot SMALLINT CHECK (mechanic_slot IS NULL OR mechanic_slot BETWEEN 1 AND 3),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_role ON users (role) WHERE active = true;

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  vin TEXT,
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name TEXT,
  provenance TEXT,
  status TEXT NOT NULL DEFAULT 'arrived' CHECK (status IN (
    'arrived',
    'in_workshop',
    'diagnostic_assigned',
    'diagnostic_complete',
    'parts_pending',
    'validation_pending',
    'repair_in_progress',
    'repair_complete',
    'bodywork_assigned',
    'bodywork_in_progress',
    'bodywork_complete',
    'ready_to_sell',
    'for_sale',
    'reserved',
    'sold'
  )),
  vei_procedure BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  workshop_notes TEXT,
  sale_notes TEXT,
  serial_confirmed BOOLEAN NOT NULL DEFAULT false,
  assigned_mechanic_id UUID REFERENCES users (id),
  assigned_bodyworker_id UUID REFERENCES users (id),
  created_by UUID REFERENCES users (id),
  sent_to_workshop_at TIMESTAMPTZ,
  diagnostic_completed_at TIMESTAMPTZ,
  repair_started_at TIMESTAMPTZ,
  repair_completed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  washed_at TIMESTAMPTZ,
  listed_at TIMESTAMPTZ,
  reserved_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  seller_expert_name TEXT,
  seller_expert_date DATE,
  seller_expert_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_status ON vehicles (status);
CREATE INDEX idx_vehicles_license ON vehicles (license_plate);
CREATE INDEX idx_vehicles_vei ON vehicles (vei_procedure) WHERE vei_procedure = true;
CREATE INDEX idx_vehicles_mechanic ON vehicles (assigned_mechanic_id);

-- ---------------------------------------------------------------------------
-- Vehicle photos (reception, final, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL DEFAULT 'exterior' CHECK (photo_type IN (
    'exterior', 'additional', 'final', 'other'
  )),
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_photos_vehicle ON vehicle_photos (vehicle_id);

-- ---------------------------------------------------------------------------
-- VEI cases
-- ---------------------------------------------------------------------------
CREATE TABLE vei_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL UNIQUE REFERENCES vehicles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'to_schedule' CHECK (status IN (
    'to_schedule', 'scheduled', 'completed'
  )),
  expert_name TEXT,
  appointment_date DATE,
  appointment_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vei_cases_status ON vei_cases (status);

-- ---------------------------------------------------------------------------
-- Mechanic assignments (dispatch history)
-- ---------------------------------------------------------------------------
CREATE TABLE mechanic_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES users (id),
  assigned_by UUID REFERENCES users (id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mechanic_assignments_vehicle ON mechanic_assignments (vehicle_id);
CREATE INDEX idx_mechanic_assignments_mechanic ON mechanic_assignments (mechanic_id);

-- ---------------------------------------------------------------------------
-- Diagnostics
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES users (id),
  defects TEXT,
  defective_parts TEXT,
  parts_to_replace TEXT,
  parts_to_repair TEXT,
  additional_needs TEXT,
  estimated_hours NUMERIC(6, 2),
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnostics_vehicle ON diagnostics (vehicle_id);
CREATE INDEX idx_diagnostics_mechanic ON diagnostics (mechanic_id);

-- ---------------------------------------------------------------------------
-- Diagnostic photos
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id UUID NOT NULL REFERENCES diagnostics (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnostic_photos_diagnostic ON diagnostic_photos (diagnostic_id);

-- ---------------------------------------------------------------------------
-- Quote lines (devis)
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id UUID NOT NULL REFERENCES diagnostics (id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL CHECK (action_type IN ('repair', 'replace')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnostic_quotes_diagnostic ON diagnostic_quotes (diagnostic_id);

-- ---------------------------------------------------------------------------
-- Parts / stock
-- ---------------------------------------------------------------------------
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  diagnostic_id UUID REFERENCES diagnostics (id) ON DELETE SET NULL,
  part_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  photo_path TEXT,
  status TEXT NOT NULL DEFAULT 'to_order' CHECK (status IN (
    'in_stock', 'to_order', 'ordered', 'received'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parts_vehicle ON parts (vehicle_id);
CREATE INDEX idx_parts_status ON parts (status);

-- ---------------------------------------------------------------------------
-- Part orders (optional detail when ordered)
-- ---------------------------------------------------------------------------
CREATE TABLE part_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts (id) ON DELETE CASCADE,
  supplier TEXT,
  order_reference TEXT,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_part_orders_part ON part_orders (part_id);

-- ---------------------------------------------------------------------------
-- Workshop validation (repair vs replace per line)
-- ---------------------------------------------------------------------------
CREATE TABLE validation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  quote_id UUID REFERENCES diagnostic_quotes (id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('repair', 'replace')),
  validated_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_validation_items_vehicle ON validation_items (vehicle_id);

-- ---------------------------------------------------------------------------
-- Repairs
-- ---------------------------------------------------------------------------
CREATE TABLE repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES users (id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'completed'
  )),
  comments TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repairs_vehicle ON repairs (vehicle_id);

-- ---------------------------------------------------------------------------
-- Bodywork
-- ---------------------------------------------------------------------------
CREATE TABLE bodywork (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  bodyworker_id UUID REFERENCES users (id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'completed'
  )),
  notes TEXT,
  assigned_by UUID REFERENCES users (id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bodywork_vehicle ON bodywork (vehicle_id);
CREATE INDEX idx_bodywork_bodyworker ON bodywork (bodyworker_id);

-- ---------------------------------------------------------------------------
-- Bodywork photos
-- ---------------------------------------------------------------------------
CREATE TABLE bodywork_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bodywork_id UUID NOT NULL REFERENCES bodywork (id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL DEFAULT 'before' CHECK (photo_type IN ('before', 'after', 'other')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bodywork_photos_bodywork ON bodywork_photos (bodywork_id);

-- ---------------------------------------------------------------------------
-- Final checklist
-- ---------------------------------------------------------------------------
CREATE TABLE final_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL UNIQUE REFERENCES vehicles (id) ON DELETE CASCADE,
  mechanics_done BOOLEAN NOT NULL DEFAULT false,
  bodywork_done BOOLEAN NOT NULL DEFAULT false,
  vehicle_complete BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  validated_by UUID REFERENCES users (id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  target_role TEXT,
  vehicle_id UUID REFERENCES vehicles (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, read);
CREATE INDEX idx_notifications_role ON notifications (target_role, read);
CREATE INDEX idx_notifications_created ON notifications (created_at DESC);

-- ---------------------------------------------------------------------------
-- Activity timeline (historique)
-- ---------------------------------------------------------------------------
CREATE TABLE vehicle_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_timeline_vehicle ON vehicle_timeline (vehicle_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER vei_cases_updated_at BEFORE UPDATE ON vei_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER mechanic_assignments_updated_at BEFORE UPDATE ON mechanic_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER diagnostics_updated_at BEFORE UPDATE ON diagnostics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER parts_updated_at BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER repairs_updated_at BEFORE UPDATE ON repairs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bodywork_updated_at BEFORE UPDATE ON bodywork
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
