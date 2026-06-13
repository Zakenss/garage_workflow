import { addTimeline, notifyRole, updateVehicleStatus } from "./db";
import { isPartsNeededText, parsePartNotes } from "./sync-checklist-parts";
import { supabase } from "./supabase";
import type { SessionUser } from "./types";
import type { MechanicReportedIssue } from "./mechanic-issues";

export type IssuePartInfo = {
  id: string;
  part_name: string;
  status: string;
  quantity: number;
  supplier: string | null;
  unit_price: number | null;
};

export type IssueRepairState =
  | "waiting_validation"
  | "waiting_parts"
  | "ready"
  | "in_progress"
  | "completed"
  | "rejected";

export type IssueWithPart = MechanicReportedIssue & {
  part: IssuePartInfo | null;
  repairState: IssueRepairState;
};

export function formatRepairDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function repairDurationMinutes(
  started: string | null,
  completed: string | null
): number | null {
  if (!started || !completed) return null;
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export function computeIssueRepairState(
  issue: MechanicReportedIssue,
  part: IssuePartInfo | null
): IssueRepairState {
  if (issue.status === "rejected") return "rejected";
  if (issue.status === "pending_manager") return "waiting_validation";
  if (issue.repair_completed_at) return "completed";
  if (issue.repair_started_at) return "in_progress";

  const needsParts = isPartsNeededText(issue.parts_needed);
  if (needsParts) {
    if (!part) return "waiting_parts";
    if (part.status !== "received") return "waiting_parts";
  }

  return "ready";
}

export const REPAIR_STATE_LABELS: Record<IssueRepairState, string> = {
  waiting_validation: "En attente validation",
  waiting_parts: "En attente pièces",
  ready: "Prêt — pièces reçues",
  in_progress: "Réparation en cours",
  completed: "Réparation terminée",
  rejected: "Refusé",
};

async function fetchPartsForVehicle(
  vehicleId: string
): Promise<(IssuePartInfo & { notes?: string | null })[]> {
  const { data, error } = await supabase
    .from("parts")
    .select("id, part_name, status, quantity, supplier, unit_price, notes")
    .eq("vehicle_id", vehicleId);

  if (error) {
    console.error("fetchPartsForVehicle:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    part_name: row.part_name,
    status: row.status,
    quantity: Number(row.quantity),
    supplier: row.supplier ?? null,
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    notes: row.notes ?? null,
  }));
}

function partInfoFromRow(
  row: IssuePartInfo & { notes?: string | null }
): IssuePartInfo {
  const { notes: _, ...rest } = row;
  void _;
  return rest;
}

export function resolvePartForIssue(
  issue: MechanicReportedIssue,
  parts: (IssuePartInfo & { notes?: string | null })[]
): IssuePartInfo | null {
  if (issue.part_id) {
    const linked = parts.find((p) => p.id === issue.part_id);
    if (linked) return partInfoFromRow(linked);
  }
  if (issue.checklist_item_id) {
    const match = parts.find(
      (p) => parsePartNotes(p.notes)?.checklistItemId === issue.checklist_item_id
    );
    if (match) return partInfoFromRow(match);
  }
  return null;
}

export async function linkIssueParts(vehicleId: string) {
  const parts = await fetchPartsForVehicle(vehicleId);
  const { data: issues } = await supabase
    .from("mechanic_reported_issues")
    .select("id, checklist_item_id, part_id")
    .eq("vehicle_id", vehicleId);

  for (const issue of issues ?? []) {
    if (issue.part_id) continue;
    const part = resolvePartForIssue(
      issue as MechanicReportedIssue,
      parts as (IssuePartInfo & { notes?: string | null })[]
    );
    if (part) {
      await supabase
        .from("mechanic_reported_issues")
        .update({ part_id: part.id })
        .eq("id", issue.id);
    }
  }
}

export async function loadVehicleIssuesWithRepair(
  vehicleId: string,
  mechanicId: string
): Promise<IssueWithPart[]> {
  const { loadVehicleIssuesWithSync } = await import("./mechanic-issues");
  await linkIssueParts(vehicleId);
  const issues = await loadVehicleIssuesWithSync(vehicleId, mechanicId);
  const parts = await fetchPartsForVehicle(vehicleId);

  return issues.map((issue) => {
    const part = resolvePartForIssue(
      issue,
      parts as (IssuePartInfo & { notes?: string | null })[]
    );
    return {
      ...issue,
      part,
      repairState: computeIssueRepairState(issue, part),
    };
  });
}

async function getIssueForRepair(issueId: string) {
  const { data, error } = await supabase
    .from("mechanic_reported_issues")
    .select("*")
    .eq("id", issueId)
    .single();
  if (error || !data) throw new Error("Signalement introuvable");
  return data as MechanicReportedIssue;
}

export async function startIssueRepair(
  issueId: string,
  user: SessionUser
) {
  const issue = await getIssueForRepair(issueId);
  const parts = await fetchPartsForVehicle(issue.vehicle_id);
  const part = resolvePartForIssue(
    issue,
    parts as (IssuePartInfo & { notes?: string | null })[]
  );
  const state = computeIssueRepairState(issue, part);

  if (state !== "ready") {
    throw new Error("Cette réparation ne peut pas être démarrée.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("mechanic_reported_issues")
    .update({ repair_started_at: now })
    .eq("id", issueId);
  if (error) throw error;

  const { data: v } = await supabase
    .from("vehicles")
    .select("license_plate, status, repair_started_at")
    .eq("id", issue.vehicle_id)
    .single();

  const vehicleExtra: Record<string, unknown> = {};
  if (!v?.repair_started_at) {
    vehicleExtra.repair_started_at = now;
  }
  if (v?.status !== "repair_in_progress" && v?.status !== "repair_complete") {
    await updateVehicleStatus(
      issue.vehicle_id,
      "repair_in_progress",
      user,
      vehicleExtra
    );
  } else if (Object.keys(vehicleExtra).length > 0) {
    await supabase
      .from("vehicles")
      .update(vehicleExtra)
      .eq("id", issue.vehicle_id);
  }

  const label = issue.checklist_label ?? "Signalement";
  const plate = v?.license_plate ?? "véhicule";
  const msg = `Réparation démarrée — ${plate} · ${label}`;

  await addTimeline(issue.vehicle_id, user.id, "followup_repair_started", {
    issueId,
    label,
    startedAt: now,
  });
  await notifyRole("workshop_manager", "followup_repair_started", msg, issue.vehicle_id);
  await notifyRole("admin", "followup_repair_started", msg, issue.vehicle_id);
}

export async function completeIssueRepair(
  issueId: string,
  user: SessionUser
) {
  const issue = await getIssueForRepair(issueId);
  if (!issue.repair_started_at) {
    throw new Error("La réparation n'a pas été démarrée.");
  }
  if (issue.repair_completed_at) {
    throw new Error("Cette réparation est déjà terminée.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("mechanic_reported_issues")
    .update({ repair_completed_at: now })
    .eq("id", issueId);
  if (error) throw error;

  const { data: v } = await supabase
    .from("vehicles")
    .select("license_plate")
    .eq("id", issue.vehicle_id)
    .single();

  const label = issue.checklist_label ?? "Signalement";
  const plate = v?.license_plate ?? "véhicule";
  const duration = repairDurationMinutes(issue.repair_started_at, now);
  const msg = `Réparation terminée — ${plate} · ${label}${
    duration != null ? ` (${formatDuration(duration)})` : ""
  }`;

  await addTimeline(issue.vehicle_id, user.id, "followup_repair_completed", {
    issueId,
    label,
    startedAt: issue.repair_started_at,
    completedAt: now,
    durationMinutes: duration,
  });
  await notifyRole("workshop_manager", "followup_repair_completed", msg, issue.vehicle_id);
  await notifyRole("admin", "followup_repair_completed", msg, issue.vehicle_id);
}
