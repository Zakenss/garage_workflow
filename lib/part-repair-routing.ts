import { addTimeline, notifyUser } from "./db";
import { updatePartOrderStatus } from "./parts-orders";
import { supabase } from "./supabase";
import type { SessionUser } from "./types";

type PartWithVehicle = {
  id: string;
  part_name: string;
  vehicle_id: string;
  vehicles: { license_plate: string; make: string; model: string } | null;
};

async function getPartWithVehicle(partId: string): Promise<PartWithVehicle> {
  const { data, error } = await supabase
    .from("parts")
    .select("id, part_name, vehicle_id, vehicles(license_plate, make, model)")
    .eq("id", partId)
    .single();

  if (error || !data) {
    throw new Error("Pièce introuvable.");
  }
  const vehicles = data.vehicles;
  const vehicle =
    vehicles == null
      ? null
      : Array.isArray(vehicles)
        ? (vehicles[0] as PartWithVehicle["vehicles"])
        : (vehicles as PartWithVehicle["vehicles"]);
  return { ...data, vehicles: vehicle } as PartWithVehicle;
}

async function getActiveBodyworkerId(): Promise<string> {
  const { data: bw } = await supabase
    .from("users")
    .select("id")
    .eq("role", "bodyworker")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!bw?.id) {
    throw new Error("Aucun carrossier actif — contactez l'administration.");
  }
  return bw.id;
}

/** Storekeeper will replace the part (new order). */
export async function markPartForReplacement(
  partId: string,
  user: SessionUser
): Promise<void> {
  const part = await getPartWithVehicle(partId);
  const { error } = await supabase
    .from("parts")
    .update({ status: "to_repair", repair_action: "replace" })
    .eq("id", partId);

  if (error) throw error;

  const plate = part.vehicles?.license_plate ?? "véhicule";
  await addTimeline(part.vehicle_id, user.id, "part_marked_replace", {
    partId,
    partName: part.part_name,
    plate,
  });
}

/** Send part repair to the bodyworker with vehicle plate for identification. */
export async function routePartToBodyworkRepair(
  partId: string,
  user: SessionUser
): Promise<void> {
  const part = await getPartWithVehicle(partId);
  const bodyworkerId = await getActiveBodyworkerId();
  const plate = part.vehicles?.license_plate ?? "véhicule";

  const { data: existing } = await supabase
    .from("bodywork")
    .select("id")
    .eq("source_part_id", partId)
    .neq("status", "completed")
    .maybeSingle();

  if (!existing) {
    const { error: insertError } = await supabase.from("bodywork").insert({
      vehicle_id: part.vehicle_id,
      bodyworker_id: bodyworkerId,
      assigned_by: user.id,
      status: "not_started",
      source_part_id: partId,
      notes: `Réparation pièce : ${part.part_name}`,
    });
    if (insertError) throw insertError;
  }

  const { error: partError } = await supabase
    .from("parts")
    .update({ status: "to_repair", repair_action: "bodywork" })
    .eq("id", partId);

  if (partError) throw partError;

  await supabase
    .from("vehicles")
    .update({ assigned_bodyworker_id: bodyworkerId })
    .eq("id", part.vehicle_id);

  await notifyUser(
    bodyworkerId,
    "part_bodywork_repair",
    `Réparation pièce — ${part.part_name} — ${plate}`,
    part.vehicle_id
  );

  await addTimeline(part.vehicle_id, user.id, "part_sent_to_bodywork", {
    partId,
    partName: part.part_name,
    plate,
    bodyworkerId,
  });
}

export async function setStorekeeperPartStatus(
  partId: string,
  status: string,
  user: SessionUser
): Promise<{ allReady: boolean }> {
  void user;
  if (status === "to_repair") {
    throw new Error("Utilisez le choix « changer » ou « carrossier » pour À réparer.");
  }
  if (status === "received" || status === "ready_for_mechanic") {
    throw new Error("Utilisez les contrôles de réception dédiés.");
  }
  await supabase
    .from("parts")
    .update({ repair_action: null })
    .eq("id", partId);
  return updatePartOrderStatus(partId, status, user);
}

export function partStatusDetailLabel(
  status: string,
  repairAction?: string | null
): string | null {
  if (status !== "to_repair" || !repairAction) return null;
  if (repairAction === "replace") return "Remplacement prévu";
  if (repairAction === "bodywork") return "Chez carrossier";
  return null;
}
