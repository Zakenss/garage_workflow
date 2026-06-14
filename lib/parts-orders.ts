import { notifyUser } from "./db";
import { linkIssueParts } from "./followup-repair";
import { supabase } from "./supabase";
import type { VehicleStatus } from "./types";

export type PartOrderRow = {
  id: string;
  part_name: string;
  quantity: number;
  status: string;
  supplier: string | null;
  unit_price: number | null;
  vehicle_id: string;
  vehicle: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
    assigned_mechanic_id: string | null;
  };
};

export type VehiclePartOrders = {
  vehicle: PartOrderRow["vehicle"];
  parts: PartOrderRow[];
  pendingCount: number;
  receivedCount: number;
};

const TERMINAL_STATUSES = new Set(["received", "in_stock"]);

export type VehiclePartsSummary = "awaiting_order" | "ordered" | "received";

export function summarizeVehicleParts(
  parts: { status: string }[]
): VehiclePartsSummary | null {
  if (parts.length === 0) return null;
  if (parts.every((p) => TERMINAL_STATUSES.has(p.status))) return "received";
  if (parts.every((p) => p.status !== "to_order")) return "ordered";
  return "awaiting_order";
}

export const PARTS_SUMMARY_LABELS: Record<VehiclePartsSummary, string> = {
  awaiting_order: "À commander",
  ordered: "Pièces commandées",
  received: "Pièces reçues",
};

export async function fetchStorekeeperPartOrders(): Promise<VehiclePartOrders[]> {
  const { data, error } = await supabase
    .from("parts")
    .select(
      "id, part_name, quantity, status, supplier, unit_price, vehicle_id, vehicles(id, license_plate, make, model, status, assigned_mechanic_id)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchStorekeeperPartOrders:", error.message);
    return [];
  }

  const byVehicle = new Map<string, VehiclePartOrders>();

  for (const row of data ?? []) {
    const vehicle = row.vehicles as PartOrderRow["vehicle"] | null;
    if (!vehicle) continue;

    const part: PartOrderRow = {
      id: row.id,
      part_name: row.part_name,
      quantity: Number(row.quantity),
      status: row.status,
      supplier: row.supplier ?? null,
      unit_price: row.unit_price != null ? Number(row.unit_price) : null,
      vehicle_id: row.vehicle_id,
      vehicle,
    };

    const group = byVehicle.get(vehicle.id) ?? {
      vehicle,
      parts: [],
      pendingCount: 0,
      receivedCount: 0,
    };
    group.parts.push(part);
    if (TERMINAL_STATUSES.has(part.status)) {
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

async function allPartsReady(vehicleId: string): Promise<boolean> {
  const { data: parts } = await supabase
    .from("parts")
    .select("status")
    .eq("vehicle_id", vehicleId);

  if (!parts?.length) return false;
  return parts.every((p) => TERMINAL_STATUSES.has(p.status));
}

/** When all parts are received/in stock, open the mechanic follow-up phase. */
export async function maybeActivateMechanicFollowup(vehicleId: string): Promise<boolean> {
  const ready = await allPartsReady(vehicleId);
  if (!ready) return false;

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("license_plate, status, assigned_mechanic_id")
    .eq("id", vehicleId)
    .single();

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

export async function updatePartOrderStatus(
  partId: string,
  status: string
): Promise<{ allReceived: boolean }> {
  const { data: part, error: partError } = await supabase
    .from("parts")
    .update({ status })
    .eq("id", partId)
    .select("vehicle_id")
    .single();

  if (partError || !part) throw partError ?? new Error("Pièce introuvable");

  const vehicleId = part.vehicle_id as string;
  await linkIssueParts(vehicleId);

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("assigned_mechanic_id, license_plate")
    .eq("id", vehicleId)
    .single();

  if (status === "received" && vehicle?.assigned_mechanic_id) {
    await notifyUser(
      vehicle.assigned_mechanic_id,
      "parts_received",
      `Pièce reçue — ${vehicle.license_plate}`,
      vehicleId
    );
  }

  const allReceived = status === "received" ? await maybeActivateMechanicFollowup(vehicleId) : false;

  return { allReceived };
}
