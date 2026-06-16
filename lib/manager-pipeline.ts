import { supabase, getPublicUrl } from "./supabase";
import type { Vehicle } from "./types";
import { dedupeById } from "./nav-utils";
export type VehicleReceptionState = Vehicle & {
  exteriorPhotoCount: number;
};

export type ReceptionPhoto = {
  id: string;
  storage_path: string;
  photo_type: string;
  url: string;
};

export function isReceptionComplete(
  vehicle: Pick<Vehicle, "vin"> & { serial_confirmed?: boolean },
  exteriorPhotoCount: number
): boolean {
  if (vehicle.serial_confirmed) return true;
  return Boolean(vehicle.vin?.trim()) && exteriorPhotoCount >= 4;
}

/** Read VIN + exterior photo count from DB for one vehicle. */
export async function fetchReceptionState(vehicleId: string): Promise<{
  vin: string | null;
  serial_confirmed: boolean;
  exteriorPhotoCount: number;
  complete: boolean;
}> {
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("vin, serial_confirmed")
    .eq("id", vehicleId)
    .single();

  const { count } = await supabase
    .from("vehicle_photos")
    .select("*", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId)
    .eq("photo_type", "exterior");

  const exteriorPhotoCount = count ?? 0;
  const row = {
    vin: vehicle?.vin ?? null,
    serial_confirmed: Boolean(vehicle?.serial_confirmed),
  };

  return {
    ...row,
    exteriorPhotoCount,
    complete: isReceptionComplete(row, exteriorPhotoCount),
  };
}

/** Batch reception-complete check for any vehicle ids (e.g. VEI list). */
export async function fetchReceptionCompleteByVehicleIds(
  vehicleIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (vehicleIds.length === 0) return result;

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, vin, serial_confirmed")
    .in("id", vehicleIds);

  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("vehicle_id")
    .eq("photo_type", "exterior")
    .in("vehicle_id", vehicleIds);

  const counts = new Map<string, number>();
  for (const row of photos ?? []) {
    counts.set(row.vehicle_id, (counts.get(row.vehicle_id) ?? 0) + 1);
  }

  for (const v of vehicles ?? []) {
    result.set(
      v.id,
      isReceptionComplete(
        { vin: v.vin, serial_confirmed: Boolean(v.serial_confirmed) },
        counts.get(v.id) ?? 0
      )
    );
  }
  return result;
}

export async function fetchReceptionPhotos(vehicleId: string): Promise<ReceptionPhoto[]> {
  const { data } = await supabase
    .from("vehicle_photos")
    .select("id, storage_path, photo_type")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    storage_path: p.storage_path,
    photo_type: p.photo_type,
    url: getPublicUrl("vehicle-photos", p.storage_path),
  }));
}

export async function deleteReceptionPhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from("vehicle_photos").delete().eq("id", photoId);
  if (error) throw error;
}

export type ManagerReceptionListMode = "pipeline" | "all";

function escapeIlikeTerm(term: string): string {
  return term.replace(/[%_,\\]/g, " ").trim();
}

async function attachExteriorPhotoCounts(
  list: Vehicle[]
): Promise<VehicleReceptionState[]> {
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

  return dedupeById(
    list.map((vehicle) => ({
      ...vehicle,
      exteriorPhotoCount: counts.get(vehicle.id) ?? 0,
    }))
  );
}

/** List vehicles for manager reception: pipeline, full browse, or search. */
export async function fetchManagerReceptionList(
  mode: ManagerReceptionListMode,
  query: string
): Promise<VehicleReceptionState[]> {
  const q = escapeIlikeTerm(query);

  if (q) {
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("*")
      .or(
        `license_plate.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,client_name.ilike.%${q}%,vin.ilike.%${q}%,provenance.ilike.%${q}%`
      )
      .order("updated_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("fetchManagerReceptionList search:", error.message);
      return [];
    }
    return attachExteriorPhotoCounts((vehicles as Vehicle[]) ?? []);
  }

  if (mode === "all") {
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(80);

    if (error) {
      console.error("fetchManagerReceptionList all:", error.message);
      return [];
    }
    return attachExteriorPhotoCounts((vehicles as Vehicle[]) ?? []);
  }

  return fetchReceptionPipelineVehicles();
}

/** @deprecated use fetchManagerReceptionList */
export async function fetchManagerVehicleSearch(
  query: string
): Promise<VehicleReceptionState[]> {
  return fetchManagerReceptionList(query.trim() ? "all" : "pipeline", query);
}

export function isVeiReadyForWorkshop(
  veiStatus: string | null | undefined,
  expertName?: string | null
): boolean {
  return veiStatus === "completed" && Boolean(expertName?.trim());
}

export function isVeiCaseComplete(
  vei: Pick<{ status: string; expert_name: string | null }, "status" | "expert_name"> | null | undefined
): boolean {
  if (!vei) return false;
  return isVeiReadyForWorkshop(vei.status, vei.expert_name);
}

export function needsVeiBeforeWorkshop(vehicle: Pick<Vehicle, "vei_procedure">): boolean {
  return vehicle.vei_procedure;
}

/** Vehicles in reception pipeline: newly arrived, not yet sent to the workshop queue. */
export async function fetchReceptionPipelineVehicles(): Promise<VehicleReceptionState[]> {
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", "arrived")
    .order("arrival_date", { ascending: false });

  if (error) {
    console.error("fetchReceptionPipelineVehicles:", error.message);
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

  return dedupeById(
    list.map((vehicle) => ({
      ...vehicle,
      exteriorPhotoCount: counts.get(vehicle.id) ?? 0,
    }))
  );
}

/** @deprecated use fetchReceptionPipelineVehicles */
export async function fetchArrivedReceptionStates(): Promise<VehicleReceptionState[]> {
  return fetchReceptionPipelineVehicles();
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
  const veiByVehicle = new Map<string, { status: string; expert_name: string | null }>();

  if (veiVehicleIds.length > 0) {
    const { data: veiCases } = await supabase
      .from("vei_cases")
      .select("vehicle_id, status, expert_name")
      .in("vehicle_id", veiVehicleIds);

    for (const row of veiCases ?? []) {
      veiByVehicle.set(row.vehicle_id, row);
    }
  }

  let pendingReception = 0;
  let pendingVei = 0;

  for (const vehicle of arrived) {
    const receptionDone = isReceptionComplete(vehicle, vehicle.exteriorPhotoCount);
    if (!receptionDone) {
      pendingReception += 1;
    }

    if (vehicle.vei_procedure) {
      const veiCase = veiByVehicle.get(vehicle.id);
      if (!isVeiCaseComplete(veiCase)) {
        pendingVei += 1;
      }
    }
  }

  return { pendingReception, pendingVei };
}

/** Vehicles repaired, awaiting manager validation before ready_to_sell. */
export async function fetchPendingFinalValidationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .in("status", ["repair_complete", "bodywork_complete"]);

  if (error) {
    console.error("fetchPendingFinalValidationCount:", error.message);
    return 0;
  }
  return count ?? 0;
}
