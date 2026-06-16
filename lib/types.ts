export type UserRole =
  | "secretary"
  | "workshop_manager"
  | "mechanic"
  | "storekeeper"
  | "bodyworker"
  | "seller"
  | "admin";

export type VehicleStatus =
  | "arrived"
  | "in_workshop"
  | "diagnostic_assigned"
  | "diagnostic_complete"
  | "parts_pending"
  | "validation_pending"
  | "repair_in_progress"
  | "repair_complete"
  | "bodywork_assigned"
  | "bodywork_in_progress"
  | "bodywork_complete"
  | "ready_to_sell"
  | "for_sale"
  | "reserved"
  | "sold";

export interface SessionUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  mechanic_slot?: number | null;
}

export interface User {
  id: string;
  full_name: string;
  username: string;
  role: UserRole;
  mechanic_slot?: number | null;
  active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  license_plate: string;
  make: string;
  model: string;
  vin: string | null;
  arrival_date: string;
  client_name: string | null;
  provenance: string | null;
  status: VehicleStatus;
  vei_procedure: boolean;
  notes: string | null;
  workshop_notes: string | null;
  sale_notes: string | null;
  washed_at?: string | null;
  ready_at?: string | null;
  listed_at?: string | null;
  reserved_at?: string | null;
  sold_at?: string | null;
  seller_expert_name?: string | null;
  seller_expert_date?: string | null;
  seller_expert_time?: string | null;
  serial_confirmed?: boolean;
  assigned_mechanic_id: string | null;
  assigned_bodyworker_id: string | null;
  dispatch_priority: number | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  target_role: string | null;
  vehicle_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}
