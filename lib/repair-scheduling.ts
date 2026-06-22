import { addTimeline, notifyUser } from "./db";
import { allPartsReadyForMechanic } from "./parts-orders";
import { supabase } from "./supabase";
import type { SessionUser } from "./types";

export type VehicleScheduleRow = {
  id: string;
  license_plate: string;
  make: string;
  model: string;
  status: string;
  assigned_mechanic_id: string | null;
  scheduled_repair_at: string | null;
  parts_ready: boolean;
  mechanic?: { full_name: string } | null;
};

export async function fetchVehiclesReadyForScheduling(): Promise<VehicleScheduleRow[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, license_plate, make, model, status, assigned_mechanic_id, scheduled_repair_at, parts_ready_notified_at, mechanic:users!assigned_mechanic_id(full_name)"
    )
    .not("parts_ready_notified_at", "is", null)
    .is("scheduled_repair_at", null)
    .in("status", ["parts_pending", "validation_pending"])
    .order("parts_ready_notified_at", { ascending: true });

  if (error) {
    console.error("fetchVehiclesReadyForScheduling:", error.message);
    return [];
  }

  const rows: VehicleScheduleRow[] = [];
  for (const v of data ?? []) {
    const ready = await allPartsReadyForMechanic(v.id);
    if (!ready) continue;
    const mechanic = Array.isArray(v.mechanic) ? v.mechanic[0] : v.mechanic;
    rows.push({
      id: v.id,
      license_plate: v.license_plate,
      make: v.make,
      model: v.model,
      status: v.status,
      assigned_mechanic_id: v.assigned_mechanic_id,
      scheduled_repair_at: v.scheduled_repair_at,
      parts_ready: true,
      mechanic: mechanic ?? null,
    });
  }
  return rows;
}

export async function scheduleVehicleRepair(
  vehicleId: string,
  mechanicId: string,
  scheduledAt: string,
  manager: SessionUser
): Promise<void> {
  const ready = await allPartsReadyForMechanic(vehicleId);
  if (!ready) {
    throw new Error("Toutes les pièces doivent être « Prêtes mécanicien » avant planification.");
  }

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("license_plate, status")
    .eq("id", vehicleId)
    .single();

  if (error || !vehicle) throw new Error("Véhicule introuvable.");

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) {
    throw new Error("Date de planification invalide.");
  }

  await supabase
    .from("vehicles")
    .update({
      assigned_mechanic_id: mechanicId,
      scheduled_repair_at: when.toISOString(),
      scheduled_by: manager.id,
      status: vehicle.status === "parts_pending" ? "validation_pending" : vehicle.status,
    })
    .eq("id", vehicleId);

  const formatted = when.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  await addTimeline(vehicleId, manager.id, "repair_scheduled", {
    mechanicId,
    scheduledAt: when.toISOString(),
  });

  await notifyUser(
    mechanicId,
    "repair_scheduled",
    `Réparation planifiée — ${vehicle.license_plate} le ${formatted}. Pièces prêtes au magasin.`,
    vehicleId
  );
}

export async function fetchMechanicScheduledVehicles(
  mechanicId: string
): Promise<
  (VehicleScheduleRow & {
    dispatch_priority: number | null;
    parts: { id: string; part_name: string; status: string }[];
  })[]
> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, license_plate, make, model, status, assigned_mechanic_id, scheduled_repair_at, dispatch_priority"
    )
    .eq("assigned_mechanic_id", mechanicId)
    .in("status", [
      "diagnostic_assigned",
      "parts_pending",
      "validation_pending",
      "repair_in_progress",
    ])
    .order("dispatch_priority", { ascending: true, nullsFirst: false })
    .order("scheduled_repair_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("fetchMechanicScheduledVehicles:", error.message);
    return [];
  }

  const rows = [];
  for (const v of data ?? []) {
    const { data: parts } = await supabase
      .from("parts")
      .select("id, part_name, status")
      .eq("vehicle_id", v.id);

    const partsReady = (parts ?? []).every(
      (p) =>
        p.status === "ready_for_mechanic" ||
        p.status === "in_stock" ||
        p.status === "received"
    );

    rows.push({
      id: v.id,
      license_plate: v.license_plate,
      make: v.make,
      model: v.model,
      status: v.status,
      assigned_mechanic_id: v.assigned_mechanic_id,
      scheduled_repair_at: v.scheduled_repair_at,
      parts_ready: partsReady && (parts?.length ?? 0) > 0,
      dispatch_priority: v.dispatch_priority,
      parts: (parts ?? []).map((p) => ({
        id: p.id,
        part_name: p.part_name,
        status: p.status,
      })),
    });
  }

  return rows;
}
