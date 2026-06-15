import { addTimeline, notifyRole } from "./db";
import { supabase } from "./supabase";
import type { Vehicle } from "./types";

export type VehicleRegistryInput = {
  license_plate: string;
  make: string;
  model: string;
  vin: string;
  arrival_date: string;
  client_name: string;
  provenance: string;
  vei_procedure: boolean;
  notes: string;
};

export async function fetchRegistryVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchRegistryVehicles:", error.message);
    return [];
  }
  return (data as Vehicle[]) ?? [];
}

export async function findVehicleByPlateExcluding(
  plate: string,
  excludeId: string
): Promise<boolean> {
  const normalized = plate.trim().toUpperCase();
  const { data } = await supabase
    .from("vehicles")
    .select("id")
    .ilike("license_plate", normalized)
    .neq("id", excludeId)
    .maybeSingle();
  return !!data;
}

export async function updateVehicleRecord(
  vehicleId: string,
  userId: string,
  input: VehicleRegistryInput,
  previous: Pick<Vehicle, "vei_procedure" | "license_plate">
): Promise<void> {
  const plate = input.license_plate.trim().toUpperCase();
  if (await findVehicleByPlateExcluding(plate, vehicleId)) {
    throw new Error("Cette immatriculation est déjà utilisée.");
  }

  const { error } = await supabase
    .from("vehicles")
    .update({
      license_plate: plate,
      make: input.make.trim(),
      model: input.model.trim(),
      vin: input.vin.trim() || null,
      arrival_date: input.arrival_date,
      client_name: input.client_name.trim() || null,
      provenance: input.provenance.trim() || null,
      vei_procedure: input.vei_procedure,
      notes: input.notes.trim() || null,
    })
    .eq("id", vehicleId);

  if (error) throw error;

  if (input.vei_procedure && !previous.vei_procedure) {
    const { data: existing } = await supabase
      .from("vei_cases")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("vei_cases").insert({ vehicle_id: vehicleId });
      await notifyRole(
        "workshop_manager",
        "vei_new",
        `Procédure VEI activée — ${plate}`,
        vehicleId
      );
    }
  }

  await addTimeline(vehicleId, userId, "vehicle_updated", {
    license_plate: plate,
    previous_plate: previous.license_plate,
  });
}

export async function deleteVehicleRecord(vehicleId: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId);
  if (error) throw error;
}

export function vehicleToForm(v: Vehicle): VehicleRegistryInput {
  return {
    license_plate: v.license_plate,
    make: v.make,
    model: v.model,
    vin: v.vin ?? "",
    arrival_date: v.arrival_date,
    client_name: v.client_name ?? "",
    provenance: v.provenance ?? "",
    vei_procedure: v.vei_procedure,
    notes: v.notes ?? "",
  };
}

export function filterRegistryVehicles(vehicles: Vehicle[], query: string): Vehicle[] {
  const q = query.trim().toLowerCase();
  if (!q) return vehicles;
  return vehicles.filter(
    (v) =>
      v.license_plate.toLowerCase().includes(q) ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      (v.client_name?.toLowerCase().includes(q) ?? false) ||
      (v.vin?.toLowerCase().includes(q) ?? false) ||
      (v.provenance?.toLowerCase().includes(q) ?? false)
  );
}
