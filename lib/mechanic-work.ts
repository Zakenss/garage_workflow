import { getPublicUrl, supabase } from "./supabase";
import { parseChecklistState } from "./reconditioning-checklist";
import { collectChecklistPartRequests, parsePartNotes } from "./sync-checklist-parts";
import type { VehicleStatus } from "./types";

export type MechanicPartRow = {
  id: string;
  part_name: string;
  quantity: number;
  status: string;
  vehicle_id: string;
  problem?: string;
  photoUrl?: string;
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

function vehicleFromJoin(v: unknown): VehicleMechanicWork["vehicle"] | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as VehicleMechanicWork["vehicle"]) ?? null;
  return v as VehicleMechanicWork["vehicle"];
}

function partRowFromDb(row: {
  id: string;
  part_name: string;
  quantity: number;
  status: string;
  vehicle_id: string;
  notes?: string | null;
  photo_path?: string | null;
}): MechanicPartRow {
  const meta = parsePartNotes(row.notes);
  return {
    id: row.id,
    part_name: row.part_name,
    quantity: row.quantity,
    status: row.status,
    vehicle_id: row.vehicle_id,
    problem: meta?.problem,
    photoUrl: row.photo_path
      ? getPublicUrl("diagnostic-photos", row.photo_path)
      : undefined,
  };
}

function mergePhotoUrls(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

export async function fetchVehicleMechanicWork(
  vehicleId: string
): Promise<{ parts: MechanicPartRow[]; photoUrls: string[] }> {
  const { data: parts } = await supabase
    .from("parts")
    .select("id, part_name, quantity, status, vehicle_id, notes, photo_path")
    .eq("vehicle_id", vehicleId)
    .order("created_at");

  const { data: diagnostics } = await supabase
    .from("diagnostics")
    .select("id, checklist_data")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  const diagPhotos: string[] = [];
  const issuePhotos: string[] = [];

  if (diagnostics?.length) {
    const { data: photoRows } = await supabase
      .from("diagnostic_photos")
      .select("storage_path")
      .in(
        "diagnostic_id",
        diagnostics.map((d) => d.id)
      );
    diagPhotos.push(
      ...(photoRows ?? []).map((x) => getPublicUrl("diagnostic-photos", x.storage_path))
    );

    for (const d of diagnostics) {
      if (!d.checklist_data) continue;
      for (const req of collectChecklistPartRequests(parseChecklistState(d.checklist_data))) {
        issuePhotos.push(
          ...req.photoPaths.map((p) => getPublicUrl("diagnostic-photos", p))
        );
      }
    }
  }

  const partRows = (parts ?? []).map(partRowFromDb);
  const partPhotoUrls = partRows
    .map((p) => p.photoUrl)
    .filter((u): u is string => Boolean(u));

  return {
    parts: partRows,
    photoUrls: mergePhotoUrls(diagPhotos, issuePhotos, partPhotoUrls),
  };
}

export async function fetchAllMechanicWork(): Promise<VehicleMechanicWork[]> {
  const { data: partsData } = await supabase
    .from("parts")
    .select(
      "id, part_name, quantity, status, vehicle_id, notes, photo_path, vehicles(id, license_plate, make, model, status)"
    )
    .order("created_at", { ascending: false });

  const { data: diagnostics } = await supabase
    .from("diagnostics")
    .select(
      "id, vehicle_id, checklist_data, vehicles(id, license_plate, make, model, status)"
    );

  const photoUrlsByVehicle = new Map<string, string[]>();
  const checklistPartsByVehicle = new Map<string, MechanicPartRow[]>();

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

    for (const d of diagnostics) {
      if (!d.checklist_data || !d.vehicle_id) continue;
      const requests = collectChecklistPartRequests(parseChecklistState(d.checklist_data));
      if (requests.length === 0) continue;

      const v = vehicleFromJoin(d.vehicles);
      if (!v) continue;

      const virtualParts: MechanicPartRow[] = requests.map((req) => ({
        id: `checklist-${req.itemId}`,
        part_name: `[${req.itemLabel}] ${req.partsNeeded}`,
        quantity: 1,
        status: "to_order",
        vehicle_id: d.vehicle_id,
        problem: req.problem,
        photoUrl: req.photoPaths[0]
          ? getPublicUrl("diagnostic-photos", req.photoPaths[0])
          : undefined,
      }));

      const existing = checklistPartsByVehicle.get(d.vehicle_id) ?? [];
      checklistPartsByVehicle.set(d.vehicle_id, [...existing, ...virtualParts]);

      const issueUrls = requests.flatMap((req) =>
        req.photoPaths.map((p) => getPublicUrl("diagnostic-photos", p))
      );
      photoUrlsByVehicle.set(
        d.vehicle_id,
        mergePhotoUrls(photoUrlsByVehicle.get(d.vehicle_id) ?? [], issueUrls)
      );
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
    const part = partRowFromDb(row);
    existing.parts.push(part);
    if (part.photoUrl) {
      existing.photoUrls = mergePhotoUrls(existing.photoUrls, [part.photoUrl]);
    }
    byVehicle.set(v.id, existing);
  }

  for (const [vehicleId, checklistParts] of checklistPartsByVehicle) {
    const v =
      byVehicle.get(vehicleId)?.vehicle ??
      vehicleFromJoin(
        diagnostics?.find((d) => d.vehicle_id === vehicleId)?.vehicles ?? null
      );
    if (!v) continue;

    const existing = byVehicle.get(vehicleId) ?? {
      vehicle: v,
      parts: [],
      photoUrls: photoUrlsByVehicle.get(vehicleId) ?? [],
    };

    const dbPartNames = new Set(existing.parts.map((p) => p.part_name));
    for (const cp of checklistParts) {
      if (!dbPartNames.has(cp.part_name)) {
        existing.parts.push(cp);
      }
    }
    existing.photoUrls = mergePhotoUrls(
      existing.photoUrls,
      photoUrlsByVehicle.get(vehicleId) ?? []
    );
    byVehicle.set(vehicleId, existing);
  }

  for (const d of diagnostics ?? []) {
    const v = vehicleFromJoin(d.vehicles);
    if (!v || byVehicle.has(v.id)) continue;
    if ((photoUrlsByVehicle.get(v.id)?.length ?? 0) > 0) {
      byVehicle.set(v.id, {
        vehicle: v,
        parts: checklistPartsByVehicle.get(v.id) ?? [],
        photoUrls: photoUrlsByVehicle.get(v.id) ?? [],
      });
    }
  }

  return Array.from(byVehicle.values()).sort((a, b) =>
    a.vehicle.license_plate.localeCompare(b.vehicle.license_plate)
  );
}
