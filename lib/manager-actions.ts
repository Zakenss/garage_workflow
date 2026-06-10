import { addTimeline, notifyUser, updateVehicleStatus } from "./db";
import { supabase } from "./supabase";
import type { SessionUser } from "./types";

export const MECHANIC_SLOTS = [1, 2, 3] as const;

export const VEI_STATUSES = ["to_schedule", "scheduled", "completed"] as const;
export type VeiStatus = (typeof VEI_STATUSES)[number];

export const REASSIGNABLE_STATUSES = [
  "diagnostic_assigned",
  "diagnostic_complete",
  "parts_pending",
  "validation_pending",
  "repair_in_progress",
] as const;

async function setOptionalPriority(vehicleId: string, priority: number | null | undefined) {
  if (priority === undefined) return;
  await supabase
    .from("vehicles")
    .update({ dispatch_priority: priority })
    .eq("id", vehicleId);
}

export async function assignVehicleToMechanic(
  vehicleId: string,
  mechanicId: string,
  user: SessionUser,
  options: {
    priority?: number | null;
    isReassign?: boolean;
    licensePlate?: string;
  } = {}
) {
  const plate = options.licensePlate ?? "véhicule";

  if (options.isReassign) {
    await supabase
      .from("mechanic_assignments")
      .update({ status: "cancelled" })
      .eq("vehicle_id", vehicleId)
      .eq("status", "active");

    await supabase.from("mechanic_assignments").insert({
      vehicle_id: vehicleId,
      mechanic_id: mechanicId,
      assigned_by: user.id,
      priority_order: options.priority ?? null,
      status: "active",
    });

    await supabase
      .from("vehicles")
      .update({ assigned_mechanic_id: mechanicId })
      .eq("id", vehicleId);
    await setOptionalPriority(vehicleId, options.priority ?? null);

    await supabase
      .from("diagnostics")
      .update({ mechanic_id: mechanicId })
      .eq("vehicle_id", vehicleId)
      .eq("status", "in_progress");

    await addTimeline(vehicleId, user.id, "mechanic_reassigned", {
      mechanicId,
      priority: options.priority ?? null,
    });
  } else {
    await supabase.from("mechanic_assignments").insert({
      vehicle_id: vehicleId,
      mechanic_id: mechanicId,
      assigned_by: user.id,
      priority_order: options.priority ?? null,
      status: "active",
    });

    await supabase
      .from("vehicles")
      .update({
        assigned_mechanic_id: mechanicId,
      })
      .eq("id", vehicleId);
    await setOptionalPriority(vehicleId, options.priority ?? null);

    await updateVehicleStatus(vehicleId, "diagnostic_assigned", user);

    await addTimeline(vehicleId, user.id, "mechanic_assigned", {
      mechanicId,
      priority: options.priority ?? null,
    });
  }

  await notifyUser(
    mechanicId,
    "diagnostic_assigned",
    options.isReassign
      ? `Véhicule réassigné — ${plate}`
      : `Nouveau véhicule assigné pour diagnostic — ${plate}`,
    vehicleId
  );
}

export async function updateVeiStatus(
  veiCaseId: string,
  status: VeiStatus,
  user: SessionUser,
  vehicleId: string
) {
  const { error } = await supabase
    .from("vei_cases")
    .update({ status })
    .eq("id", veiCaseId);
  if (error) throw error;

  await addTimeline(vehicleId, user.id, "vei_status_change", { status });
}

export async function saveMechanicQueueOrder(vehicleIds: string[]) {
  await Promise.all(
    vehicleIds.map((id, index) => saveVehiclePriority(id, index + 1))
  );
}

export async function saveVehiclePriority(
  vehicleId: string,
  priority: number | null
) {
  await setOptionalPriority(vehicleId, priority);
}

export function mechanicsBySlot<T extends { id: string; mechanic_slot?: number | null }>(
  mechanics: T[]
): Record<number, T | undefined> {
  const map: Record<number, T | undefined> = {};
  for (const slot of MECHANIC_SLOTS) {
    map[slot] = mechanics.find((m) => m.mechanic_slot === slot);
  }
  return map;
}
