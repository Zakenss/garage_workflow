import { addTimeline, notifyUser, updateVehicleStatus } from "./db";
import {
  fetchReceptionCompleteByVehicleIds,
  isVeiCaseComplete,
} from "./manager-pipeline";
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

  const { data: vehicleRow } = await supabase
    .from("vehicles")
    .select("vei_procedure")
    .eq("id", vehicleId)
    .single();

  if (vehicleRow?.vei_procedure && !options.isReassign) {
    const { data: veiCase } = await supabase
      .from("vei_cases")
      .select("status, expert_name")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();
    if (!isVeiCaseComplete(veiCase)) {
      throw new Error(
        "Expertise VEI non finalisée — confirmez la réalisation et l'expert avant assignation."
      );
    }
  }

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
  if (status === "completed") {
    const { data: veiCase } = await supabase
      .from("vei_cases")
      .select("expert_name")
      .eq("id", veiCaseId)
      .single();
    if (!veiCase?.expert_name?.trim()) {
      throw new Error("Indiquez le nom de l'expert avant de confirmer la VEI réalisée.");
    }
  }

  const { error } = await supabase
    .from("vei_cases")
    .update({ status })
    .eq("id", veiCaseId);
  if (error) throw error;

  await addTimeline(vehicleId, user.id, "vei_status_change", { status });
}

export type VeiCaseInput = {
  expert_name: string;
  appointment_date: string;
  appointment_time: string;
  notes: string;
  status: VeiStatus;
};

export async function saveVeiCaseDetails(
  veiCaseId: string,
  vehicleId: string,
  user: SessionUser,
  input: VeiCaseInput
) {
  if (input.status === "completed" && !input.expert_name.trim()) {
    throw new Error("Le nom de l'expert est requis pour confirmer la VEI réalisée.");
  }

  const { error } = await supabase
    .from("vei_cases")
    .update({
      expert_name: input.expert_name.trim() || null,
      appointment_date: input.appointment_date || null,
      appointment_time: input.appointment_time || null,
      notes: input.notes.trim() || null,
      status: input.status,
    })
    .eq("id", veiCaseId);
  if (error) throw error;

  await addTimeline(vehicleId, user.id, "vei_updated", {
    status: input.status,
    expert_name: input.expert_name.trim() || null,
  });
}

export async function sendVehicleToWorkshop(
  vehicleId: string,
  user: SessionUser,
  input: { vin: string; workshop_notes: string | null }
) {
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("status, vei_procedure")
    .eq("id", vehicleId)
    .single();

  if (!vehicle) throw new Error("Véhicule introuvable.");
  if (vehicle.status !== "arrived" && vehicle.status !== "in_workshop") {
    throw new Error("Ce véhicule n'est plus en phase de réception.");
  }

  const receptionByVehicle = await fetchReceptionCompleteByVehicleIds([vehicleId]);
  if (!receptionByVehicle.get(vehicleId)) {
    throw new Error("Réception incomplète — VIN / série et 4 photos extérieures requis.");
  }

  if (vehicle.vei_procedure) {
    const { data: veiCase } = await supabase
      .from("vei_cases")
      .select("status, expert_name")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();
    if (!isVeiCaseComplete(veiCase)) {
      throw new Error(
        "Expertise VEI non finalisée — statut « Réalisé » et expert requis."
      );
    }
  }

  await supabase
    .from("vehicles")
    .update({
      vin: input.vin.trim(),
      workshop_notes: input.workshop_notes,
      serial_confirmed: true,
      sent_to_workshop_at: new Date().toISOString(),
    })
    .eq("id", vehicleId);

  if (vehicle.status === "arrived") {
    await updateVehicleStatus(vehicleId, "in_workshop", user);
  }
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
