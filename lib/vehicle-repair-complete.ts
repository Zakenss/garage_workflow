import { addTimeline, notifyRole, updateVehicleStatus } from "./db";
import { generateAndStoreRepairCostReport } from "./repair-cost-report";
import {
  computeIssueRepairState,
  fetchPartsForVehicle,
  resolvePartForIssue,
} from "./followup-repair";
import { supabase } from "./supabase";
import type { MechanicReportedIssue } from "./mechanic-issues";
import type { SessionUser } from "./types";

const PARTS_READY = new Set(["received", "in_stock", "ready_for_mechanic"]);
const COMPLETABLE_STATUSES = new Set(["repair_in_progress", "validation_pending"]);

export type RepairCompletionAssessment = {
  canComplete: boolean;
  blockers: string[];
};

export async function assessVehicleRepairCompletion(
  vehicleId: string
): Promise<RepairCompletionAssessment> {
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("status, license_plate")
    .eq("id", vehicleId)
    .single();

  if (!vehicle) {
    return { canComplete: false, blockers: ["Véhicule introuvable."] };
  }

  if (!COMPLETABLE_STATUSES.has(vehicle.status)) {
    return {
      canComplete: false,
      blockers: ["Ce véhicule n'est pas en phase de réparation atelier."],
    };
  }

  const blockers: string[] = [];

  const { data: parts } = await supabase
    .from("parts")
    .select("status")
    .eq("vehicle_id", vehicleId);

  if (parts?.some((p) => !PARTS_READY.has(p.status))) {
    blockers.push("Des pièces ne sont pas encore reçues par le magasinier.");
  }

  const { data: issues } = await supabase
    .from("mechanic_reported_issues")
    .select("*")
    .eq("vehicle_id", vehicleId);

  const partRows = await fetchPartsForVehicle(vehicleId);

  for (const row of issues ?? []) {
    const issue = row as MechanicReportedIssue;
    if (issue.status === "pending_manager") {
      blockers.push("Un signalement attend encore la validation du chef d'atelier.");
      continue;
    }
    if (issue.status !== "approved" && !issue.repair_completed_at) continue;

    const part = resolvePartForIssue(issue, partRows);
    const state = computeIssueRepairState(issue, part);
    const label = issue.checklist_label ?? "signalement";

    if (state === "waiting_parts") {
      blockers.push(`Pièces manquantes pour « ${label} ».`);
    } else if (state === "ready") {
      blockers.push(`Réparation non terminée : « ${label} ».`);
    } else if (state === "in_progress") {
      blockers.push(`Réparation en cours : « ${label} ».`);
    }
  }

  return { canComplete: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export async function completeVehicleReconditioning(
  vehicleId: string,
  user: SessionUser
): Promise<void> {
  const { canComplete, blockers } = await assessVehicleRepairCompletion(vehicleId);
  if (!canComplete) {
    throw new Error(blockers[0] ?? "Impossible de terminer le reconditionnement.");
  }

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("license_plate, assigned_mechanic_id")
    .eq("id", vehicleId)
    .single();

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("repairs")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();

  const repairPayload = {
    vehicle_id: vehicleId,
    mechanic_id: user.id,
    status: "completed",
    completed_at: now,
  };

  if (existing) {
    await supabase.from("repairs").update(repairPayload).eq("id", existing.id);
  } else {
    await supabase.from("repairs").insert({
      ...repairPayload,
      started_at: now,
    });
  }

  await updateVehicleStatus(vehicleId, "repair_complete", user, {
    repair_completed_at: now,
  });

  const plate = vehicle?.license_plate ?? "véhicule";
  const msg = `Reconditionnement terminé — ${plate} — validation finale requise`;

  await addTimeline(vehicleId, user.id, "reconditioning_complete", {
    completedAt: now,
  });
  await notifyRole("workshop_manager", "repair_complete", msg, vehicleId);
  await notifyRole("admin", "repair_complete", msg, vehicleId);

  try {
    await generateAndStoreRepairCostReport(vehicleId, user);
  } catch (err) {
    console.error("repair cost report generation failed:", err);
  }
}

export async function tryAutoCompleteVehicleReconditioning(
  vehicleId: string,
  user: SessionUser
): Promise<boolean> {
  const { canComplete } = await assessVehicleRepairCompletion(vehicleId);
  if (!canComplete) return false;
  await completeVehicleReconditioning(vehicleId, user);
  return true;
}
