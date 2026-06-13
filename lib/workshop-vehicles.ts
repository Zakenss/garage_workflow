import {
  WORKSHOP_ACTIVE_STATUSES,
  WORKSHOP_ASSIGNED_STATUSES,
  WORKSHOP_REPAIR_COMPLETE_STATUS,
  WORKSHOP_WAITING_STATUS,
} from "./manager";
import { supabase } from "./supabase";
import type { Vehicle, VehicleStatus } from "./types";

export type VehicleWithMechanic = Vehicle & {
  mechanic: { id: string; full_name: string; mechanic_slot: number | null } | null;
};

export type AssignmentHistoryRow = {
  id: string;
  created_at: string;
  status: string;
  priority_order: number | null;
  vehicles: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
  };
  mechanic: { full_name: string; mechanic_slot: number | null };
  assigned_by_user: { full_name: string } | null;
};

export function sortByDispatchPriority<
  T extends { dispatch_priority?: number | null; updated_at: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = a.dispatch_priority ?? 9999;
    const pb = b.dispatch_priority ?? 9999;
    if (pa !== pb) return pa - pb;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export async function fetchWaitingVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", WORKSHOP_WAITING_STATUS)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchWaitingVehicles:", error.message);
    return [];
  }
  return sortByDispatchPriority((data as Vehicle[]) ?? []);
}

export async function fetchAssignedVehicles(): Promise<VehicleWithMechanic[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, mechanic:users!assigned_mechanic_id(id, full_name, mechanic_slot)")
    .in("status", WORKSHOP_ASSIGNED_STATUSES)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchAssignedVehicles:", error.message);
    return [];
  }
  return sortByDispatchPriority((data as VehicleWithMechanic[]) ?? []);
}

export async function fetchAllWorkshopVehicles(): Promise<VehicleWithMechanic[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, mechanic:users!assigned_mechanic_id(id, full_name, mechanic_slot)")
    .in("status", WORKSHOP_ACTIVE_STATUSES)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchAllWorkshopVehicles:", error.message);
    return [];
  }
  return sortByDispatchPriority((data as VehicleWithMechanic[]) ?? []);
}

export async function fetchRepairCompleteVehicles(): Promise<VehicleWithMechanic[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, mechanic:users!assigned_mechanic_id(id, full_name, mechanic_slot)")
    .eq("status", WORKSHOP_REPAIR_COMPLETE_STATUS)
    .order("repair_completed_at", { ascending: false });

  if (error) {
    console.error("fetchRepairCompleteVehicles:", error.message);
    return [];
  }
  return (data as VehicleWithMechanic[]) ?? [];
}

export async function fetchAssignmentHistory(
  limit = 50
): Promise<AssignmentHistoryRow[]> {
  const { data, error } = await supabase
    .from("mechanic_assignments")
    .select(
      "id, created_at, status, priority_order, vehicles(id, license_plate, make, model, status), mechanic:users!mechanic_id(full_name, mechanic_slot), assigned_by_user:users!assigned_by(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchAssignmentHistory:", error.message);
    return [];
  }
  return (data as unknown as AssignmentHistoryRow[]) ?? [];
}

export function groupVehiclesByMechanic(
  mechanics: { id: string; full_name: string; mechanic_slot?: number | null }[],
  assigned: VehicleWithMechanic[]
) {
  return mechanics
    .filter((m) => m.mechanic_slot != null)
    .sort((a, b) => (a.mechanic_slot ?? 0) - (b.mechanic_slot ?? 0))
    .map((mechanic) => ({
      mechanic,
      vehicles: sortByDispatchPriority(
        assigned.filter((v) => v.assigned_mechanic_id === mechanic.id)
      ),
    }));
}
