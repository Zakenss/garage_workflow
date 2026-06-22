import { supabase } from "./supabase";
import type { VehicleStatus } from "./types";

export type PartCostLine = {
  id: string;
  part_name: string;
  quantity: number;
  quantity_received?: number;
  unit_price: number | null;
  supplier: string | null;
  status: string;
  repair_action: string | null;
  lineTotal: number;
};

export type VehiclePartsCost = {
  vehicle: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
  };
  parts: PartCostLine[];
  totalCost: number;
  pricedCount: number;
  partsCount: number;
};

function vehicleFromJoin(v: unknown): VehiclePartsCost["vehicle"] | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as VehiclePartsCost["vehicle"]) ?? null;
  return v as VehiclePartsCost["vehicle"];
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function lineTotal(quantity: number, unitPrice: number | null): number {
  if (unitPrice == null || Number.isNaN(unitPrice)) return 0;
  return quantity * unitPrice;
}

export async function savePartPricing(
  partId: string,
  supplier: string,
  unitPrice: number
) {
  const { error } = await supabase
    .from("parts")
    .update({
      supplier: supplier.trim() || null,
      unit_price: unitPrice,
    })
    .eq("id", partId);
  if (error) throw error;
}

export async function fetchAllVehiclePartCosts(): Promise<VehiclePartsCost[]> {
  const { data, error } = await supabase
    .from("parts")
    .select(
      "id, part_name, quantity, quantity_received, unit_price, supplier, status, repair_action, vehicle_id, vehicles(id, license_plate, make, model, status)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchAllVehiclePartCosts:", error.message);
    return [];
  }

  const byVehicle = new Map<string, VehiclePartsCost>();

  for (const row of data ?? []) {
    const v = vehicleFromJoin(row.vehicles);
    if (!v) continue;

    const unitPrice =
      row.unit_price != null ? Number(row.unit_price) : null;
    const part: PartCostLine = {
      id: row.id,
      part_name: row.part_name,
      quantity: Number(row.quantity),
      quantity_received: Number(row.quantity_received ?? 0),
      unit_price: unitPrice,
      supplier: row.supplier ?? null,
      status: row.status,
      repair_action: row.repair_action ?? null,
      lineTotal: lineTotal(Number(row.quantity), unitPrice),
    };

    const existing = byVehicle.get(v.id) ?? {
      vehicle: v,
      parts: [],
      totalCost: 0,
      pricedCount: 0,
      partsCount: 0,
    };
    existing.parts.push(part);
    existing.partsCount += 1;
    if (unitPrice != null && unitPrice > 0) {
      existing.pricedCount += 1;
      existing.totalCost += part.lineTotal;
    }
    byVehicle.set(v.id, existing);
  }

  return Array.from(byVehicle.values())
    .filter((g) => g.partsCount > 0)
    .sort((a, b) => a.vehicle.license_plate.localeCompare(b.vehicle.license_plate));
}

export async function fetchVehiclePartCost(
  vehicleId: string
): Promise<VehiclePartsCost | null> {
  const all = await fetchAllVehiclePartCosts();
  return all.find((g) => g.vehicle.id === vehicleId) ?? null;
}

export function grandTotal(groups: VehiclePartsCost[]): number {
  return groups.reduce((sum, g) => sum + g.totalCost, 0);
}
