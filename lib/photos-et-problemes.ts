import { parseChecklistState } from "./reconditioning-checklist";
import {
  collectChecklistSignalements,
  parsePartNotes,
  type ChecklistPartNotes,
} from "./sync-checklist-parts";
import type { MechanicReportedIssue } from "./mechanic-issues";
import { fetchAllVehiclePartCosts, type VehiclePartsCost } from "./parts-costs";
import { getPublicUrl, supabase } from "./supabase";
import type { VehicleStatus } from "./types";

export type PhotosEtProblemesVehicle = {
  vehicle: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
  };
  submittedAt: string;
  mechanicName: string | null;
  signalements: MechanicReportedIssue[];
  parts: VehiclePartsCost["parts"];
};

function parsePartName(partName: string): { label: string; partsNeeded: string } {
  const match = partName.match(/^\[(.+?)\]\s*(.*)$/);
  if (match) {
    return { label: match[1], partsNeeded: match[2] || partName };
  }
  return { label: partName, partsNeeded: partName };
}

function signalementFromPart(
  part: {
    id: string;
    part_name: string;
    photo_path?: string | null;
    notes?: string | null;
  },
  vehicleId: string,
  mechanicId: string
): MechanicReportedIssue | null {
  const meta = parsePartNotes(part.notes);
  const { label, partsNeeded } = parsePartName(part.part_name);
  const problem = meta?.problem?.trim();
  const photoPaths = part.photo_path ? [part.photo_path] : [];
  if (!problem && photoPaths.length === 0) return null;

  return {
    id: `part-${part.id}`,
    vehicle_id: vehicleId,
    mechanic_id: mechanicId,
    source: "checklist",
    checklist_item_id: meta?.checklistItemId ?? null,
    checklist_label: label,
    problem: problem || "Problème signalé (voir photo)",
    parts_needed: partsNeeded,
    photo_paths: photoPaths,
    status: "approved",
    validated_by: null,
    validated_at: null,
    part_id: part.id,
    repair_started_at: null,
    repair_completed_at: null,
    created_at: new Date().toISOString(),
  };
}

function signalementFromChecklistItem(
  item: {
    itemId: string;
    itemLabel: string;
    problem: string;
    partsNeeded: string;
    photoPaths: string[];
  },
  vehicleId: string,
  mechanicId: string
): MechanicReportedIssue {
  return {
    id: `checklist-${item.itemId}`,
    vehicle_id: vehicleId,
    mechanic_id: mechanicId,
    source: "checklist",
    checklist_item_id: item.itemId,
    checklist_label: item.itemLabel,
    problem: item.problem,
    parts_needed: item.partsNeeded,
    photo_paths: item.photoPaths,
    status: "approved",
    validated_by: null,
    validated_at: null,
    part_id: null,
    repair_started_at: null,
    repair_completed_at: null,
    created_at: new Date().toISOString(),
  };
}

function mergeSignalements(
  fromChecklist: MechanicReportedIssue[],
  fromParts: MechanicReportedIssue[]
): MechanicReportedIssue[] {
  const byItemId = new Map<string, MechanicReportedIssue>();

  for (const s of fromChecklist) {
    if (s.checklist_item_id) {
      byItemId.set(s.checklist_item_id, s);
    } else {
      byItemId.set(s.id, s);
    }
  }

  for (const s of fromParts) {
    const key = s.checklist_item_id ?? s.id;
    const existing = byItemId.get(key);
    if (!existing) {
      byItemId.set(key, s);
      continue;
    }
    byItemId.set(key, {
      ...existing,
      problem: existing.problem || s.problem,
      parts_needed: existing.parts_needed || s.parts_needed,
      photo_paths:
        existing.photo_paths.length > 0 ? existing.photo_paths : s.photo_paths,
      part_id: existing.part_id ?? s.part_id,
    });
  }

  return Array.from(byItemId.values()).sort((a, b) =>
    (a.checklist_label ?? "").localeCompare(b.checklist_label ?? "")
  );
}

export function partPhotoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;
  return getPublicUrl("diagnostic-photos", photoPath);
}

export async function fetchPhotosEtProblemesVehicles(): Promise<PhotosEtProblemesVehicle[]> {
  const { data: diagnostics, error } = await supabase
    .from("diagnostics")
    .select(
      "signed_at, checklist_data, mechanic_id, mechanic:users!mechanic_id(full_name), vehicle:vehicles(id, license_plate, make, model, status)"
    )
    .not("signed_at", "is", null)
    .order("signed_at", { ascending: false });

  if (error) {
    console.error("fetchPhotosEtProblemesVehicles:", error.message);
    return [];
  }

  const { data: partsRows } = await supabase
    .from("parts")
    .select("id, part_name, photo_path, notes, vehicle_id")
    .order("created_at", { ascending: false });

  const partsByVehicle = new Map<
    string,
    { id: string; part_name: string; photo_path: string | null; notes: string | null }[]
  >();
  for (const p of partsRows ?? []) {
    const list = partsByVehicle.get(p.vehicle_id) ?? [];
    list.push(p);
    partsByVehicle.set(p.vehicle_id, list);
  }

  const costGroups = await fetchAllVehiclePartCosts();
  const costByVehicle = new Map(costGroups.map((g) => [g.vehicle.id, g.parts]));

  const byVehicle = new Map<string, PhotosEtProblemesVehicle>();

  for (const row of diagnostics ?? []) {
    const vehicle = row.vehicle as PhotosEtProblemesVehicle["vehicle"] | null;
    if (!vehicle || !row.signed_at) continue;

    const existing = byVehicle.get(vehicle.id);
    if (existing && existing.submittedAt >= row.signed_at) continue;

    const mechanicId = row.mechanic_id as string;
    const mechanic = row.mechanic as { full_name: string } | null;
    const state = parseChecklistState(row.checklist_data);

    const fromChecklist = collectChecklistSignalements(state).map((item) =>
      signalementFromChecklistItem(item, vehicle.id, mechanicId)
    );

    const vehicleParts = partsByVehicle.get(vehicle.id) ?? [];
    const fromParts = vehicleParts
      .map((p) => signalementFromPart(p, vehicle.id, mechanicId))
      .filter((s): s is MechanicReportedIssue => s !== null);

    byVehicle.set(vehicle.id, {
      vehicle,
      submittedAt: row.signed_at,
      mechanicName: mechanic?.full_name ?? null,
      signalements: mergeSignalements(fromChecklist, fromParts),
      parts: costByVehicle.get(vehicle.id) ?? [],
    });
  }

  return Array.from(byVehicle.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export type { ChecklistPartNotes };
