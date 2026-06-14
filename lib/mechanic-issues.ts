import { notifyRole } from "./db";
import type { ChecklistState } from "./reconditioning-checklist";
import { collectChecklistPartRequests, isPartsNeededText } from "./sync-checklist-parts";
import { getPublicUrl, supabase } from "./supabase";
import type { VehicleStatus } from "./types";

export type IssueStatus = "pending_manager" | "approved" | "rejected";

export type MechanicReportedIssue = {
  id: string;
  vehicle_id: string;
  mechanic_id: string;
  source: "checklist" | "followup";
  checklist_item_id: string | null;
  checklist_label: string | null;
  problem: string;
  parts_needed: string;
  photo_paths: string[];
  status: IssueStatus;
  validated_by: string | null;
  validated_at: string | null;
  part_id: string | null;
  repair_started_at: string | null;
  repair_completed_at: string | null;
  created_at: string;
  mechanic?: { full_name: string } | null;
  vehicle?: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
  } | null;
};

export type VehicleIssuesGroup = {
  vehicle: NonNullable<MechanicReportedIssue["vehicle"]>;
  issues: MechanicReportedIssue[];
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  pending_manager: "En attente chef d'atelier",
  approved: "Validé — à commander",
  rejected: "Refusé",
};

export function issuePhotoUrls(issue: MechanicReportedIssue): string[] {
  return (issue.photo_paths ?? []).map((p) =>
    getPublicUrl("diagnostic-photos", p)
  );
}

function rowToIssue(row: Record<string, unknown>): MechanicReportedIssue {
  return {
    ...(row as MechanicReportedIssue),
    photo_paths: Array.isArray(row.photo_paths) ? (row.photo_paths as string[]) : [],
  };
}

export async function findVehicleByPlate(plate: string) {
  const normalized = plate.trim().toUpperCase();
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .ilike("license_plate", normalized)
    .maybeSingle();
  return data;
}

export async function fetchVehicleIssues(
  vehicleId: string
): Promise<MechanicReportedIssue[]> {
  const { data, error } = await supabase
    .from("mechanic_reported_issues")
    .select("*, mechanic:users!mechanic_id(full_name)")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchVehicleIssues:", error.message);
    return [];
  }
  return (data ?? []).map(rowToIssue);
}

export async function fetchPendingIssues(): Promise<MechanicReportedIssue[]> {
  const { data, error } = await supabase
    .from("mechanic_reported_issues")
    .select(
      "*, mechanic:users!mechanic_id(full_name), vehicle:vehicles(id, license_plate, make, model, status)"
    )
    .eq("status", "pending_manager")
    .eq("source", "followup")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchPendingIssues:", error.message);
    return [];
  }
  return (data ?? []).map(rowToIssue);
}

function groupIssuesByVehicle(
  data: Record<string, unknown>[] | null
): VehicleIssuesGroup[] {
  const byVehicle = new Map<string, VehicleIssuesGroup>();
  for (const row of data ?? []) {
    const issue = rowToIssue(row);
    const v = issue.vehicle;
    if (!v) continue;
    const existing = byVehicle.get(v.id) ?? { vehicle: v, issues: [] };
    existing.issues.push(issue);
    byVehicle.set(v.id, existing);
  }
  return Array.from(byVehicle.values()).sort((a, b) =>
    a.vehicle.license_plate.localeCompare(b.vehicle.license_plate)
  );
}

export async function fetchAllIssuesGrouped(): Promise<VehicleIssuesGroup[]> {
  const { data, error } = await supabase
    .from("mechanic_reported_issues")
    .select(
      "*, mechanic:users!mechanic_id(full_name), vehicle:vehicles(id, license_plate, make, model, status)"
    )
    .neq("status", "rejected")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchAllIssuesGrouped:", error.message);
    return [];
  }

  return groupIssuesByVehicle(data);
}

/** Initial mechanic checklist signalements only (Photos et problèmes). */
export async function fetchChecklistIssuesGrouped(): Promise<VehicleIssuesGroup[]> {
  const { data, error } = await supabase
    .from("mechanic_reported_issues")
    .select(
      "*, mechanic:users!mechanic_id(full_name), vehicle:vehicles(id, license_plate, make, model, status)"
    )
    .eq("source", "checklist")
    .neq("status", "rejected")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchChecklistIssuesGrouped:", error.message);
    return [];
  }

  return groupIssuesByVehicle(data);
}

/** Forgotten-piece signalements awaiting manager validation. */
export async function fetchFollowupIssuesGrouped(): Promise<VehicleIssuesGroup[]> {
  const { data, error } = await supabase
    .from("mechanic_reported_issues")
    .select(
      "*, mechanic:users!mechanic_id(full_name), vehicle:vehicles(id, license_plate, make, model, status)"
    )
    .eq("source", "followup")
    .neq("status", "rejected")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchFollowupIssuesGrouped:", error.message);
    return [];
  }

  return groupIssuesByVehicle(data);
}

export type SubmittedChecklistRow = {
  vehicle: NonNullable<MechanicReportedIssue["vehicle"]>;
  submittedAt: string;
  mechanicName: string | null;
};

/** Vehicles whose mechanic submitted the initial reconditioning checklist. */
export async function fetchSubmittedChecklistVehicles(): Promise<SubmittedChecklistRow[]> {
  const { data, error } = await supabase
    .from("diagnostics")
    .select(
      "signed_at, mechanic:users!mechanic_id(full_name), vehicle:vehicles(id, license_plate, make, model, status)"
    )
    .not("signed_at", "is", null)
    .order("signed_at", { ascending: false });

  if (error) {
    console.error("fetchSubmittedChecklistVehicles:", error.message);
    return [];
  }

  const byVehicle = new Map<string, SubmittedChecklistRow>();
  for (const row of data ?? []) {
    const raw = row.vehicle;
    const v = Array.isArray(raw)
      ? (raw[0] as SubmittedChecklistRow["vehicle"] | undefined) ?? null
      : (raw as SubmittedChecklistRow["vehicle"] | null);
    if (!v || !row.signed_at) continue;
    const existing = byVehicle.get(v.id);
    if (existing && existing.submittedAt >= row.signed_at) continue;
    const mechanic = row.mechanic as { full_name: string } | null;
    byVehicle.set(v.id, {
      vehicle: v,
      submittedAt: row.signed_at,
      mechanicName: mechanic?.full_name ?? null,
    });
  }

  return Array.from(byVehicle.values()).sort((a, b) =>
    a.vehicle.license_plate.localeCompare(b.vehicle.license_plate)
  );
}

export async function syncChecklistToReportedIssues(
  vehicleId: string,
  mechanicId: string,
  state: ChecklistState
) {
  const { collectChecklistSignalements } = await import("./sync-checklist-parts");
  const requests = collectChecklistSignalements(state);
  const activeIds = new Set<string>();

  for (const req of requests) {
    activeIds.add(req.itemId);
    const payload = {
      vehicle_id: vehicleId,
      mechanic_id: mechanicId,
      source: "checklist" as const,
      checklist_item_id: req.itemId,
      checklist_label: req.itemLabel,
      problem: req.problem,
      parts_needed: req.partsNeeded,
      photo_paths: req.photoPaths,
    };

    const { data: existing, error: findError } = await supabase
      .from("mechanic_reported_issues")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .eq("checklist_item_id", req.itemId)
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("syncChecklistToReportedIssues find:", findError.message);
      continue;
    }

    if (existing) {
      const { error } = await supabase
        .from("mechanic_reported_issues")
        .update(payload)
        .eq("id", existing.id);
      if (error) console.error("syncChecklistToReportedIssues update:", error.message);
      continue;
    }

    const { error: insertError } = await supabase.from("mechanic_reported_issues").insert({
      ...payload,
      status: "approved",
      validated_at: new Date().toISOString(),
    });

    if (!insertError) continue;

    const isDuplicate =
      insertError.code === "23505" ||
      insertError.message.includes("duplicate key");

    if (isDuplicate) {
      const { error: updateError } = await supabase
        .from("mechanic_reported_issues")
        .update(payload)
        .eq("vehicle_id", vehicleId)
        .eq("checklist_item_id", req.itemId);
      if (updateError) {
        console.error("syncChecklistToReportedIssues retry update:", updateError.message);
      }
    } else {
      console.error("syncChecklistToReportedIssues insert:", insertError.message);
    }
  }

  const { data: all } = await supabase
    .from("mechanic_reported_issues")
    .select("id, checklist_item_id")
    .eq("vehicle_id", vehicleId)
    .eq("source", "checklist");

  for (const row of all ?? []) {
    if (row.checklist_item_id && !activeIds.has(row.checklist_item_id)) {
      await supabase.from("mechanic_reported_issues").delete().eq("id", row.id);
    }
  }
}

export async function createFollowupIssue(
  vehicleId: string,
  mechanicId: string,
  input: {
    problem: string;
    partsNeeded: string;
    photoPaths: string[];
    checklistLabel?: string;
  }
) {
  const { data, error } = await supabase
    .from("mechanic_reported_issues")
    .insert({
      vehicle_id: vehicleId,
      mechanic_id: mechanicId,
      source: "followup",
      checklist_label: input.checklistLabel ?? "Signalement complémentaire",
      problem: input.problem,
      parts_needed: input.partsNeeded,
      photo_paths: input.photoPaths,
      status: "pending_manager",
    })
    .select("id")
    .single();

  if (error) throw error;

  const { data: v } = await supabase
    .from("vehicles")
    .select("license_plate")
    .eq("id", vehicleId)
    .single();

  await notifyRole(
    "workshop_manager",
    "issue_pending_validation",
    `Nouveau problème signalé — ${v?.license_plate ?? "véhicule"}`,
    vehicleId
  );

  return data!.id as string;
}

export async function approveIssue(
  issueId: string,
  managerId: string,
  vehicleId: string
) {
  const { data: issue } = await supabase
    .from("mechanic_reported_issues")
    .select("*")
    .eq("id", issueId)
    .single();

  if (!issue) throw new Error("Signalement introuvable");

  let partId: string | null = null;

  if (isPartsNeededText(issue.parts_needed)) {
    const label = issue.checklist_label ?? "Signalement";
    const part_name = `[${label}] ${issue.parts_needed}`;
    const photo_path = (issue.photo_paths as string[])?.[0] ?? null;

    const { data: part } = await supabase
      .from("parts")
      .insert({
        vehicle_id: vehicleId,
        part_name,
        quantity: 1,
        status: "to_order",
        photo_path,
        notes: JSON.stringify({ reportedIssueId: issueId, problem: issue.problem }),
      })
      .select("id")
      .single();
    partId = part?.id ?? null;
  }

  await supabase
    .from("mechanic_reported_issues")
    .update({
      status: "approved",
      validated_by: managerId,
      validated_at: new Date().toISOString(),
      part_id: partId,
    })
    .eq("id", issueId);

  const { data: v } = await supabase
    .from("vehicles")
    .select("license_plate")
    .eq("id", vehicleId)
    .single();

  await notifyRole(
    "storekeeper",
    "issue_approved",
    `Pièce à commander — ${v?.license_plate ?? "véhicule"}: ${issue.parts_needed}`,
    vehicleId
  );
}

export async function rejectIssue(issueId: string, managerId: string) {
  await supabase
    .from("mechanic_reported_issues")
    .update({
      status: "rejected",
      validated_by: managerId,
      validated_at: new Date().toISOString(),
    })
    .eq("id", issueId);
}

export async function submitStorekeeperChecklist(
  vehicleId: string,
  userId: string
) {
  const { data: v } = await supabase
    .from("vehicles")
    .select("license_plate")
    .eq("id", vehicleId)
    .single();

  await supabase
    .from("storekeeper_checklists")
    .update({
      submitted_at: new Date().toISOString(),
      submitted_by: userId,
    })
    .eq("vehicle_id", vehicleId);

  await notifyRole(
    "workshop_manager",
    "storekeeper_checklist_submitted",
    `Check-list magasinier soumise — ${v?.license_plate ?? "véhicule"}`,
    vehicleId
  );
}

export async function loadVehicleIssuesWithSync(
  vehicleId: string,
  mechanicId: string
) {
  const { data: diag } = await supabase
    .from("diagnostics")
    .select("checklist_data, mechanic_id")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (diag?.checklist_data) {
    const { parseChecklistState } = await import("./reconditioning-checklist");
    await syncChecklistToReportedIssues(
      vehicleId,
      diag.mechanic_id ?? mechanicId,
      parseChecklistState(diag.checklist_data)
    );
  }

  return fetchVehicleIssues(vehicleId);
}
