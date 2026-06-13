import {
  computeIssueRepairState,
  formatDuration,
  formatRepairDate,
  repairDurationMinutes,
  resolvePartForIssue,
  type IssuePartInfo,
  type IssueRepairState,
} from "./followup-repair";
import { issuePhotoUrls, type MechanicReportedIssue } from "./mechanic-issues";
import { lineTotal } from "./parts-costs";
import { supabase } from "./supabase";
import type { VehicleStatus } from "./types";

function mechanicNameFromJoin(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const row = v as Record<string, unknown>;
  const m = row.assigned_mechanic;
  if (!m) return null;
  if (Array.isArray(m)) return (m[0] as { full_name?: string })?.full_name ?? null;
  return (m as { full_name?: string }).full_name ?? null;
}

export type SupervisionIssue = MechanicReportedIssue & {
  part: IssuePartInfo | null;
  repairState: IssueRepairState;
  photoUrls: string[];
  durationMinutes: number | null;
};

export type SupervisionPart = {
  id: string;
  part_name: string;
  quantity: number;
  status: string;
  supplier: string | null;
  unit_price: number | null;
  lineTotal: number;
};

export type SupervisionVehicle = {
  vehicle: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
    assigned_mechanic_id: string | null;
    repair_started_at: string | null;
    repair_completed_at: string | null;
  };
  mechanicName: string | null;
  issues: SupervisionIssue[];
  parts: SupervisionPart[];
  totalPartsCost: number;
  activeRepairs: number;
  completedRepairs: number;
};

function vehicleFromJoin(v: unknown): SupervisionVehicle["vehicle"] | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as SupervisionVehicle["vehicle"]) ?? null;
  return v as SupervisionVehicle["vehicle"];
}

type PartRow = SupervisionPart & { notes?: string | null };

function buildPartRow(row: Record<string, unknown>): PartRow {
  const unitPrice = row.unit_price != null ? Number(row.unit_price) : null;
  const quantity = Number(row.quantity);
  return {
    id: row.id as string,
    part_name: row.part_name as string,
    quantity,
    status: row.status as string,
    supplier: (row.supplier as string | null) ?? null,
    unit_price: unitPrice,
    lineTotal: lineTotal(quantity, unitPrice),
    notes: (row.notes as string | null) ?? null,
  };
}

function publicParts(parts: PartRow[]): SupervisionPart[] {
  return parts.map(({ notes, ...part }) => {
    void notes;
    return part;
  });
}

export async function fetchWorkshopSupervision(): Promise<SupervisionVehicle[]> {
  const [issuesRes, partsRes] = await Promise.all([
    supabase
      .from("mechanic_reported_issues")
      .select(
        "*, mechanic:users!mechanic_id(full_name), vehicle:vehicles(id, license_plate, make, model, status, assigned_mechanic_id, repair_started_at, repair_completed_at, assigned_mechanic:users!assigned_mechanic_id(full_name))"
      )
      .neq("status", "rejected")
      .order("created_at", { ascending: false }),
    supabase
      .from("parts")
      .select("id, part_name, quantity, status, supplier, unit_price, notes, vehicle_id")
      .order("created_at", { ascending: false }),
  ]);

  if (issuesRes.error) {
    console.error("fetchWorkshopSupervision issues:", issuesRes.error.message);
  }
  if (partsRes.error) {
    console.error("fetchWorkshopSupervision parts:", partsRes.error.message);
  }

  const partsByVehicle = new Map<string, PartRow[]>();
  for (const row of (partsRes.data ?? []) as Record<string, unknown>[]) {
    const vehicleId = row.vehicle_id as string;
    const list = partsByVehicle.get(vehicleId) ?? [];
    list.push(buildPartRow(row));
    partsByVehicle.set(vehicleId, list);
  }

  const byVehicle = new Map<string, SupervisionVehicle>();

  for (const row of issuesRes.data ?? []) {
    const issue = {
      ...(row as MechanicReportedIssue),
      photo_paths: Array.isArray(row.photo_paths)
        ? (row.photo_paths as string[])
        : [],
    };
    const v = vehicleFromJoin(row.vehicle);
    if (!v) continue;

    const vehicleParts = partsByVehicle.get(v.id) ?? [];
    const part = resolvePartForIssue(issue, vehicleParts);
    const repairState = computeIssueRepairState(issue, part);

    const supervisionIssue: SupervisionIssue = {
      ...issue,
      part,
      repairState,
      photoUrls: issuePhotoUrls(issue),
      durationMinutes: repairDurationMinutes(
        issue.repair_started_at ?? null,
        issue.repair_completed_at ?? null
      ),
    };

    const mechanicName =
      issue.mechanic?.full_name ?? mechanicNameFromJoin(row.vehicle) ?? null;

    const existing = byVehicle.get(v.id) ?? {
      vehicle: v,
      mechanicName,
      issues: [],
      parts: publicParts(vehicleParts),
      totalPartsCost: vehicleParts.reduce((s, p) => s + p.lineTotal, 0),
      activeRepairs: 0,
      completedRepairs: 0,
    };

    existing.issues.push(supervisionIssue);
    if (repairState === "in_progress") existing.activeRepairs += 1;
    if (repairState === "completed") existing.completedRepairs += 1;
    if (!existing.mechanicName && mechanicName) {
      existing.mechanicName = mechanicName;
    }

    byVehicle.set(v.id, existing);
  }

  const orphanIds = [...partsByVehicle.keys()].filter((id) => !byVehicle.has(id));
  if (orphanIds.length > 0) {
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select(
        "id, license_plate, make, model, status, assigned_mechanic_id, repair_started_at, repair_completed_at, assigned_mechanic:users!assigned_mechanic_id(full_name)"
      )
      .in("id", orphanIds);

    for (const v of vehicles ?? []) {
      const vehicleParts = partsByVehicle.get(v.id) ?? [];
      byVehicle.set(v.id, {
        vehicle: v as SupervisionVehicle["vehicle"],
        mechanicName: mechanicNameFromJoin(v),
        issues: [],
        parts: publicParts(vehicleParts),
        totalPartsCost: vehicleParts.reduce((s, p) => s + p.lineTotal, 0),
        activeRepairs: 0,
        completedRepairs: 0,
      });
    }
  }

  return Array.from(byVehicle.values()).sort((a, b) => {
    if (a.activeRepairs !== b.activeRepairs) return b.activeRepairs - a.activeRepairs;
    return a.vehicle.license_plate.localeCompare(b.vehicle.license_plate);
  });
}

export { formatRepairDate, formatDuration };
export { REPAIR_STATE_LABELS } from "./followup-repair";
