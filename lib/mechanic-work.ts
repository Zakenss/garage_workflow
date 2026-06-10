import { getPublicUrl, supabase } from "./supabase";
import type { VehicleStatus } from "./types";

export type MechanicPartRow = {
  id: string;
  part_name: string;
  quantity: number;
  status: string;
  vehicle_id: string;
};

export type VehicleMechanicWork = {
  vehicle: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
  };
  parts: MechanicPartRow[];
  photoUrls: string[];
};

export async function fetchVehicleMechanicWork(
  vehicleId: string
): Promise<{ parts: MechanicPartRow[]; photoUrls: string[] }> {
  const { data: parts } = await supabase
    .from("parts")
    .select("id, part_name, quantity, status, vehicle_id")
    .eq("vehicle_id", vehicleId)
    .order("created_at");

  const { data: diagnostics } = await supabase
    .from("diagnostics")
    .select("id")
    .eq("vehicle_id", vehicleId);

  let photoUrls: string[] = [];
  if (diagnostics?.length) {
    const { data: photoRows } = await supabase
      .from("diagnostic_photos")
      .select("storage_path")
      .in(
        "diagnostic_id",
        diagnostics.map((d) => d.id)
      );
    photoUrls = (photoRows ?? []).map((x) =>
      getPublicUrl("diagnostic-photos", x.storage_path)
    );
  }

  return { parts: (parts as MechanicPartRow[]) ?? [], photoUrls };
}

function vehicleFromJoin(v: unknown): VehicleMechanicWork["vehicle"] | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as VehicleMechanicWork["vehicle"]) ?? null;
  return v as VehicleMechanicWork["vehicle"];
}

export async function fetchAllMechanicWork(): Promise<VehicleMechanicWork[]> {
  const { data: partsData } = await supabase
    .from("parts")
    .select(
      "id, part_name, quantity, status, vehicle_id, vehicles(id, license_plate, make, model, status)"
    )
    .order("created_at", { ascending: false });

  const { data: diagnostics } = await supabase
    .from("diagnostics")
    .select("id, vehicle_id, vehicles(id, license_plate, make, model, status)");

  const photoUrlsByVehicle = new Map<string, string[]>();
  if (diagnostics?.length) {
    const { data: photoRows } = await supabase
      .from("diagnostic_photos")
      .select("storage_path, diagnostic_id")
      .in(
        "diagnostic_id",
        diagnostics.map((d) => d.id)
      );

    const diagToVehicle = new Map(diagnostics.map((d) => [d.id, d.vehicle_id]));
    for (const row of photoRows ?? []) {
      const vehicleId = diagToVehicle.get(row.diagnostic_id);
      if (!vehicleId) continue;
      const url = getPublicUrl("diagnostic-photos", row.storage_path);
      const list = photoUrlsByVehicle.get(vehicleId) ?? [];
      list.push(url);
      photoUrlsByVehicle.set(vehicleId, list);
    }
  }

  const byVehicle = new Map<string, VehicleMechanicWork>();

  for (const row of partsData ?? []) {
    const v = vehicleFromJoin(row.vehicles);
    if (!v) continue;
    const existing = byVehicle.get(v.id) ?? {
      vehicle: v,
      parts: [],
      photoUrls: photoUrlsByVehicle.get(v.id) ?? [],
    };
    existing.parts.push({
      id: row.id,
      part_name: row.part_name,
      quantity: row.quantity,
      status: row.status,
      vehicle_id: row.vehicle_id,
    });
    byVehicle.set(v.id, existing);
  }

  for (const d of diagnostics ?? []) {
    const v = vehicleFromJoin(d.vehicles);
    if (!v || byVehicle.has(v.id)) continue;
    if ((photoUrlsByVehicle.get(v.id)?.length ?? 0) > 0) {
      byVehicle.set(v.id, {
        vehicle: v,
        parts: [],
        photoUrls: photoUrlsByVehicle.get(v.id) ?? [],
      });
    }
  }

  return Array.from(byVehicle.values()).sort((a, b) =>
    a.vehicle.license_plate.localeCompare(b.vehicle.license_plate)
  );
}
