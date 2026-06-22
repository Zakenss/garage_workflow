import { addTimeline, notifyRole, notifyUser } from "./db";
import { canStorekeeperOrderParts, usesPartsApprovalWorkflow } from "./parts-approval";
import { linkIssueParts } from "./followup-repair";
import { supabase } from "./supabase";
import type { PartsListStatus, SessionUser, VehicleStatus } from "./types";

export type PartOrderRow = {
  id: string;
  part_name: string;
  quantity: number;
  quantity_received: number;
  status: string;
  supplier: string | null;
  unit_price: number | null;
  repair_action: string | null;
  vehicle_id: string;
  vehicle: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
    assigned_mechanic_id: string | null;
    parts_list_status: PartsListStatus | null;
  };
};

export type VehiclePartOrders = {
  vehicle: PartOrderRow["vehicle"];
  parts: PartOrderRow[];
  pendingCount: number;
  receivedCount: number;
  readyCount: number;
};

function vehicleFromJoin(v: unknown): PartOrderRow["vehicle"] | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as PartOrderRow["vehicle"]) ?? null;
  return v as PartOrderRow["vehicle"];
}

const LEGACY_TERMINAL_STATUSES = new Set(["received", "in_stock"]);
const NEW_TERMINAL_STATUSES = new Set(["ready_for_mechanic", "in_stock"]);

export type VehiclePartsSummary =
  | "awaiting_approval"
  | "awaiting_order"
  | "ordered"
  | "received"
  | "ready_for_mechanic";

export function summarizeVehicleParts(
  parts: { status: string }[],
  partsListStatus?: PartsListStatus | null
): VehiclePartsSummary | null {
  if (parts.length === 0) return null;

  if (
    usesPartsApprovalWorkflow(partsListStatus) &&
    partsListStatus !== "approved"
  ) {
    if (partsListStatus === "pending_approval") return "awaiting_approval";
    return "awaiting_order";
  }

  if (parts.every((p) => NEW_TERMINAL_STATUSES.has(p.status) || (partsListStatus == null && LEGACY_TERMINAL_STATUSES.has(p.status)))) {
    if (parts.every((p) => p.status === "ready_for_mechanic" || p.status === "in_stock")) {
      return "ready_for_mechanic";
    }
    if (partsListStatus == null && parts.every((p) => LEGACY_TERMINAL_STATUSES.has(p.status))) {
      return "received";
    }
  }

  if (parts.some((p) => p.status === "received")) return "received";
  if (parts.some((p) => p.status === "ordered" || p.status === "to_repair")) return "ordered";
  return "awaiting_order";
}

export const PARTS_SUMMARY_LABELS: Record<VehiclePartsSummary, string> = {
  awaiting_approval: "En attente validation chef d'atelier",
  awaiting_order: "À commander",
  ordered: "Pièces commandées",
  received: "Réception en cours",
  ready_for_mechanic: "Prêtes pour le mécanicien",
};

async function getVehiclePartsContext(vehicleId: string) {
  const { data } = await supabase
    .from("vehicles")
    .select("parts_list_status, license_plate, status, assigned_mechanic_id, parts_ready_notified_at")
    .eq("id", vehicleId)
    .single();
  return data;
}

function terminalStatusesForVehicle(
  partsListStatus: PartsListStatus | null | undefined
): Set<string> {
  if (usesPartsApprovalWorkflow(partsListStatus)) {
    return NEW_TERMINAL_STATUSES;
  }
  return LEGACY_TERMINAL_STATUSES;
}

export async function allPartsReadyForMechanic(vehicleId: string): Promise<boolean> {
  const vehicle = await getVehiclePartsContext(vehicleId);
  const { data: parts } = await supabase
    .from("parts")
    .select("status")
    .eq("vehicle_id", vehicleId);

  if (!parts?.length) return false;
  const terminal = terminalStatusesForVehicle(
    (vehicle?.parts_list_status as PartsListStatus | null) ?? null
  );
  return parts.every((p) => terminal.has(p.status));
}

/** Notify workshop manager when all parts are ready for mechanic pickup. */
export async function maybeNotifyManagerPartsReady(vehicleId: string): Promise<boolean> {
  const ready = await allPartsReadyForMechanic(vehicleId);
  if (!ready) return false;

  const vehicle = await getVehiclePartsContext(vehicleId);
  if (!vehicle) return false;
  if (vehicle.parts_ready_notified_at) return false;

  await supabase
    .from("vehicles")
    .update({ parts_ready_notified_at: new Date().toISOString() })
    .eq("id", vehicleId);

  await notifyRole(
    "workshop_manager",
    "parts_ready_for_scheduling",
    `Pièces prêtes — ${vehicle.license_plate}. Planifiez la réparation et assignez le mécanicien.`,
    vehicleId
  );

  return true;
}

/** Legacy: all parts received → mechanic follow-up phase. */
export async function maybeActivateMechanicFollowup(vehicleId: string): Promise<boolean> {
  const vehicle = await getVehiclePartsContext(vehicleId);
  if (usesPartsApprovalWorkflow(vehicle?.parts_list_status as PartsListStatus | null)) {
    return maybeNotifyManagerPartsReady(vehicleId);
  }

  const { data: parts } = await supabase
    .from("parts")
    .select("status")
    .eq("vehicle_id", vehicleId);

  if (!parts?.length) return false;
  if (!parts.every((p) => LEGACY_TERMINAL_STATUSES.has(p.status))) return false;
  if (!vehicle?.assigned_mechanic_id) return false;

  if (vehicle.status === "parts_pending") {
    await supabase
      .from("vehicles")
      .update({ status: "validation_pending" })
      .eq("id", vehicleId);
  }

  await notifyUser(
    vehicle.assigned_mechanic_id,
    "parts_all_received",
    `Toutes les pièces reçues — ${vehicle.license_plate}. Ouvrez Signalements pour confirmer, réparer ou signaler une pièce oubliée.`,
    vehicleId
  );

  return true;
}

export async function fetchStorekeeperPartOrders(): Promise<VehiclePartOrders[]> {
  const { data, error } = await supabase
    .from("parts")
    .select(
      "id, part_name, quantity, quantity_received, status, supplier, unit_price, repair_action, vehicle_id, vehicles(id, license_plate, make, model, status, assigned_mechanic_id, parts_list_status)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchStorekeeperPartOrders:", error.message);
    return [];
  }

  const byVehicle = new Map<string, VehiclePartOrders>();

  for (const row of data ?? []) {
    const vehicle = vehicleFromJoin(row.vehicles);
    if (!vehicle) continue;

    const part: PartOrderRow = {
      id: row.id,
      part_name: row.part_name,
      quantity: Number(row.quantity),
      quantity_received: Number(row.quantity_received ?? 0),
      status: row.status,
      supplier: row.supplier ?? null,
      unit_price: row.unit_price != null ? Number(row.unit_price) : null,
      repair_action: row.repair_action ?? null,
      vehicle_id: row.vehicle_id,
      vehicle: {
        ...vehicle,
        parts_list_status: (vehicle.parts_list_status as PartsListStatus | null) ?? null,
      },
    };

    const group = byVehicle.get(vehicle.id) ?? {
      vehicle: part.vehicle,
      parts: [],
      pendingCount: 0,
      receivedCount: 0,
      readyCount: 0,
    };
    group.parts.push(part);
    if (part.status === "ready_for_mechanic" || part.status === "in_stock") {
      group.readyCount += 1;
    } else if (part.status === "received") {
      group.receivedCount += 1;
    } else {
      group.pendingCount += 1;
    }
    byVehicle.set(vehicle.id, group);
  }

  return Array.from(byVehicle.values())
    .filter((g) => g.parts.length > 0)
    .sort((a, b) => a.vehicle.license_plate.localeCompare(b.vehicle.license_plate));
}

export async function updatePartOrderStatus(
  partId: string,
  status: string,
  user?: SessionUser
): Promise<{ allReady: boolean }> {
  const { data: part, error: partError } = await supabase
    .from("parts")
    .select("vehicle_id, part_name, quantity, status")
    .eq("id", partId)
    .single();

  if (partError || !part) throw partError ?? new Error("Pièce introuvable");

  const vehicle = await getVehiclePartsContext(part.vehicle_id);
  const partsListStatus = (vehicle?.parts_list_status as PartsListStatus | null) ?? null;

  if (status === "ordered" && !canStorekeeperOrderParts(partsListStatus)) {
    throw new Error(
      "La liste pièces doit être validée par le chef d'atelier avant toute commande."
    );
  }

  const updates: Record<string, unknown> = { status };
  if (status === "received") {
    updates.quantity_received = Number(part.quantity);
  }

  const { error: updateError } = await supabase
    .from("parts")
    .update(updates)
    .eq("id", partId);

  if (updateError) throw updateError;

  const vehicleId = part.vehicle_id as string;
  await linkIssueParts(vehicleId);

  if (user && status === "received") {
    await addTimeline(vehicleId, user.id, "part_received", {
      partId,
      partName: part.part_name,
      quantity: part.quantity,
    });
  }

  if (status === "received" && vehicle?.assigned_mechanic_id && partsListStatus == null) {
    await notifyUser(
      vehicle.assigned_mechanic_id,
      "parts_received",
      `Pièce reçue — ${vehicle.license_plate}`,
      vehicleId
    );
  }

  let allReady = false;
  if (status === "received" || status === "ready_for_mechanic") {
    allReady = await maybeActivateMechanicFollowup(vehicleId);
  }

  return { allReady };
}

export async function recordPartReceipt(
  partId: string,
  quantityReceived: number,
  user: SessionUser
): Promise<{ fullyReceived: boolean }> {
  if (quantityReceived < 1) throw new Error("Quantité reçue invalide.");

  const { data: part, error } = await supabase
    .from("parts")
    .select("vehicle_id, part_name, quantity, status, quantity_received")
    .eq("id", partId)
    .single();

  if (error || !part) throw new Error("Pièce introuvable.");
  if (part.status !== "ordered" && part.status !== "received") {
    throw new Error("Seules les pièces commandées peuvent être réceptionnées.");
  }

  const qty = Number(part.quantity);
  const received = Math.min(quantityReceived, qty);
  const fullyReceived = received >= qty;

  const { error: updateError } = await supabase
    .from("parts")
    .update({
      quantity_received: received,
      status: "received",
    })
    .eq("id", partId);

  if (updateError) throw updateError;

  await addTimeline(part.vehicle_id, user.id, "part_received", {
    partId,
    partName: part.part_name,
    quantityReceived: received,
    quantityOrdered: qty,
    partial: !fullyReceived,
  });

  return { fullyReceived };
}

export async function markPartReadyForMechanic(
  partId: string,
  user: SessionUser
): Promise<{ allReady: boolean }> {
  const { data: part, error } = await supabase
    .from("parts")
    .select("vehicle_id, part_name, quantity, quantity_received, status")
    .eq("id", partId)
    .single();

  if (error || !part) throw new Error("Pièce introuvable.");
  if (part.status !== "received") {
    throw new Error("Réceptionnez la pièce avant de la marquer prête pour le mécanicien.");
  }
  if (Number(part.quantity_received) < Number(part.quantity)) {
    throw new Error("Réception incomplète — complétez la quantité reçue.");
  }

  const { error: updateError } = await supabase
    .from("parts")
    .update({ status: "ready_for_mechanic" })
    .eq("id", partId);

  if (updateError) throw updateError;

  await addTimeline(part.vehicle_id, user.id, "part_ready_for_mechanic", {
    partId,
    partName: part.part_name,
  });

  const allReady = await maybeActivateMechanicFollowup(part.vehicle_id);
  return { allReady };
}

export async function markAllPartsReadyForMechanic(
  vehicleId: string,
  user: SessionUser
): Promise<{ allReady: boolean }> {
  const { data: parts } = await supabase
    .from("parts")
    .select("id, quantity, quantity_received, status")
    .eq("vehicle_id", vehicleId);

  const receivable = (parts ?? []).filter(
    (p) => p.status === "received" && Number(p.quantity_received) >= Number(p.quantity)
  );

  if (receivable.length === 0) {
    throw new Error("Aucune pièce réceptionnée complète à marquer prête.");
  }

  for (const p of receivable) {
    await supabase
      .from("parts")
      .update({ status: "ready_for_mechanic" })
      .eq("id", p.id);
    await addTimeline(vehicleId, user.id, "part_ready_for_mechanic", { partId: p.id });
  }

  return { allReady: await maybeActivateMechanicFollowup(vehicleId) };
}
