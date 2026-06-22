import { addTimeline, notifyRole } from "./db";
import { supabase } from "./supabase";
import type { PartsListStatus, SessionUser } from "./types";

export type VehiclePartsApproval = {
  vehicle_id: string;
  license_plate: string;
  make: string;
  model: string;
  status: string;
  parts_list_status: PartsListStatus | null;
  parts_list_submitted_at: string | null;
  parts_list_rejection_comment: string | null;
  parts_count: number;
  priced_count: number;
  total_cost: number;
};

/** Legacy jobs without parts_list_status skip the approval gate. */
export function usesPartsApprovalWorkflow(
  partsListStatus: PartsListStatus | null | undefined
): boolean {
  return partsListStatus != null;
}

export function canStorekeeperOrderParts(
  partsListStatus: PartsListStatus | null | undefined
): boolean {
  if (!usesPartsApprovalWorkflow(partsListStatus)) return true;
  return partsListStatus === "approved";
}

export const PARTS_LIST_STATUS_LABELS: Record<
  NonNullable<PartsListStatus>,
  string
> = {
  draft: "Brouillon",
  pending_approval: "En attente validation",
  approved: "Validée — commande autorisée",
  rejected: "Refusée",
};

export async function fetchVehiclePartsApproval(
  vehicleId: string
): Promise<VehiclePartsApproval | null> {
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select(
      "id, license_plate, make, model, status, parts_list_status, parts_list_submitted_at, parts_list_rejection_comment"
    )
    .eq("id", vehicleId)
    .single();

  if (error || !vehicle) return null;

  const { data: parts } = await supabase
    .from("parts")
    .select("unit_price, quantity")
    .eq("vehicle_id", vehicleId);

  const rows = parts ?? [];
  let totalCost = 0;
  let pricedCount = 0;
  for (const p of rows) {
    const price = p.unit_price != null ? Number(p.unit_price) : null;
    if (price != null && price > 0) {
      pricedCount += 1;
      totalCost += price * Number(p.quantity);
    }
  }

  return {
    vehicle_id: vehicle.id,
    license_plate: vehicle.license_plate,
    make: vehicle.make,
    model: vehicle.model,
    status: vehicle.status,
    parts_list_status: (vehicle.parts_list_status as PartsListStatus | null) ?? null,
    parts_list_submitted_at: vehicle.parts_list_submitted_at ?? null,
    parts_list_rejection_comment: vehicle.parts_list_rejection_comment ?? null,
    parts_count: rows.length,
    priced_count: pricedCount,
    total_cost: totalCost,
  };
}

export async function initVehiclePartsListDraft(vehicleId: string): Promise<void> {
  const { data } = await supabase
    .from("vehicles")
    .select("parts_list_status")
    .eq("id", vehicleId)
    .single();

  if (data?.parts_list_status != null) return;

  await supabase
    .from("vehicles")
    .update({ parts_list_status: "draft" })
    .eq("id", vehicleId);
}

export async function submitPartsListForApproval(
  vehicleId: string,
  user: SessionUser
): Promise<void> {
  const approval = await fetchVehiclePartsApproval(vehicleId);
  if (!approval) throw new Error("Véhicule introuvable.");
  if (approval.parts_count === 0) {
    throw new Error("Aucune pièce à soumettre pour ce véhicule.");
  }
  if (approval.priced_count < approval.parts_count) {
    throw new Error("Renseignez le fournisseur et le prix de chaque pièce avant soumission.");
  }
  if (approval.parts_list_status === "pending_approval") {
    throw new Error("La liste est déjà en attente de validation.");
  }
  if (approval.parts_list_status === "approved") {
    throw new Error("La liste est déjà validée.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("vehicles")
    .update({
      parts_list_status: "pending_approval",
      parts_list_submitted_at: now,
      parts_list_submitted_by: user.id,
      parts_list_rejection_comment: null,
    })
    .eq("id", vehicleId);

  if (error) throw error;

  await addTimeline(vehicleId, user.id, "parts_list_submitted", {
    partsCount: approval.parts_count,
    totalCost: approval.total_cost,
  });

  await notifyRole(
    "workshop_manager",
    "parts_list_pending_approval",
    `Liste pièces à valider — ${approval.license_plate} (${approval.parts_count} pièce${approval.parts_count > 1 ? "s" : ""})`,
    vehicleId
  );
}

export async function approvePartsList(
  vehicleId: string,
  manager: SessionUser
): Promise<void> {
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("license_plate, parts_list_status")
    .eq("id", vehicleId)
    .single();

  if (error || !vehicle) throw new Error("Véhicule introuvable.");
  if (vehicle.parts_list_status !== "pending_approval") {
    throw new Error("Cette liste n'est pas en attente de validation.");
  }

  const now = new Date().toISOString();
  await supabase
    .from("vehicles")
    .update({
      parts_list_status: "approved",
      parts_list_reviewed_by: manager.id,
      parts_list_reviewed_at: now,
      parts_list_rejection_comment: null,
    })
    .eq("id", vehicleId);

  await addTimeline(vehicleId, manager.id, "parts_list_approved", {});

  await notifyRole(
    "storekeeper",
    "parts_list_approved",
    `Liste pièces validée — ${vehicle.license_plate}. Vous pouvez passer les commandes.`,
    vehicleId
  );
}

export async function rejectPartsList(
  vehicleId: string,
  manager: SessionUser,
  comment: string
): Promise<void> {
  const trimmed = comment.trim();
  if (!trimmed) throw new Error("Indiquez un commentaire de refus.");

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("license_plate, parts_list_status")
    .eq("id", vehicleId)
    .single();

  if (error || !vehicle) throw new Error("Véhicule introuvable.");
  if (vehicle.parts_list_status !== "pending_approval") {
    throw new Error("Cette liste n'est pas en attente de validation.");
  }

  const now = new Date().toISOString();
  await supabase
    .from("vehicles")
    .update({
      parts_list_status: "rejected",
      parts_list_reviewed_by: manager.id,
      parts_list_reviewed_at: now,
      parts_list_rejection_comment: trimmed,
    })
    .eq("id", vehicleId);

  await addTimeline(vehicleId, manager.id, "parts_list_rejected", { comment: trimmed });

  await notifyRole(
    "storekeeper",
    "parts_list_rejected",
    `Liste pièces refusée — ${vehicle.license_plate}: ${trimmed}`,
    vehicleId
  );
}

export async function fetchPendingPartsApprovals(): Promise<VehiclePartsApproval[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, license_plate, make, model, status, parts_list_status, parts_list_submitted_at, parts_list_rejection_comment"
    )
    .eq("parts_list_status", "pending_approval")
    .order("parts_list_submitted_at", { ascending: true });

  if (error) {
    console.error("fetchPendingPartsApprovals:", error.message);
    return [];
  }

  const results: VehiclePartsApproval[] = [];
  for (const v of data ?? []) {
    const detail = await fetchVehiclePartsApproval(v.id);
    if (detail) results.push(detail);
  }
  return results;
}

export async function countPendingPartsApprovals(): Promise<number> {
  const { count, error } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("parts_list_status", "pending_approval");

  if (error) return 0;
  return count ?? 0;
}
