import { supabase } from "./supabase";
import type { Vehicle } from "./types";

export type VehicleReceptionState = Vehicle & {
  exteriorPhotoCount: number;
};

export function isReceptionComplete(
  vehicle: Pick<Vehicle, "vin">,
  exteriorPhotoCount: number
): boolean {
  return Boolean(vehicle.vin?.trim()) && exteriorPhotoCount >= 4;
}

export function isVeiReadyForWorkshop(veiStatus: string | null | undefined): boolean {
  return veiStatus === "completed" || veiStatus === "scheduled";
}

export function needsVeiBeforeWorkshop(vehicle: Pick<Vehicle, "vei_procedure">): boolean {
  return vehicle.vei_procedure;
}

export async function fetchArrivedReceptionStates(): Promise<VehicleReceptionState[]> {
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", "arrived")
    .order("arrival_date", { ascending: false });

  if (error) {
    console.error("fetchArrivedReceptionStates:", error.message);
    return [];
  }

  const list = (vehicles as Vehicle[]) ?? [];
  if (list.length === 0) return [];

  const ids = list.map((v) => v.id);
  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("vehicle_id")
    .eq("photo_type", "exterior")
    .in("vehicle_id", ids);

  const counts = new Map<string, number>();
  for (const row of photos ?? []) {
    counts.set(row.vehicle_id, (counts.get(row.vehicle_id) ?? 0) + 1);
  }

  return list.map((vehicle) => ({
    ...vehicle,
    exteriorPhotoCount: counts.get(vehicle.id) ?? 0,
  }));
}

export async function fetchManagerPipelineCounts(): Promise<{
  pendingReception: number;
  pendingVei: number;
}> {
  const arrived = await fetchArrivedReceptionStates();
  if (arrived.length === 0) {
    return { pendingReception: 0, pendingVei: 0 };
  }

  const veiVehicleIds = arrived.filter((v) => v.vei_procedure).map((v) => v.id);
  const veiByVehicle = new Map<string, string>();

  if (veiVehicleIds.length > 0) {
    const { data: veiCases } = await supabase
      .from("vei_cases")
      .select("vehicle_id, status")
      .in("vehicle_id", veiVehicleIds);

    for (const row of veiCases ?? []) {
      veiByVehicle.set(row.vehicle_id, row.status);
    }
  }

  let pendingReception = 0;
  let pendingVei = 0;

  for (const vehicle of arrived) {
    const receptionDone = isReceptionComplete(vehicle, vehicle.exteriorPhotoCount);
    if (!receptionDone) {
      pendingReception += 1;
    }

    if (
      vehicle.vei_procedure &&
      !isVeiReadyForWorkshop(veiByVehicle.get(vehicle.id))
    ) {
      pendingVei += 1;
    }
  }

  return { pendingReception, pendingVei };
}
