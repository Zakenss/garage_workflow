"use client";

import {
  REPAIR_STATE_LABELS,
  formatDuration,
  formatRepairDate,
  repairDurationMinutes,
  type IssueWithPart,
} from "@/lib/followup-repair";
import { PART_STATUS_LABELS } from "@/lib/constants";
import { ISSUE_STATUS_LABELS, issuePhotoUrls } from "@/lib/mechanic-issues";
import { formatEuro } from "@/lib/parts-costs";

function repairStateBadgeClass(state: IssueWithPart["repairState"]): string {
  switch (state) {
    case "ready":
      return "bg-blue-100 text-blue-900";
    case "in_progress":
      return "bg-amber-100 text-amber-900";
    case "completed":
      return "bg-emerald-100 text-emerald-900";
    case "waiting_parts":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function FollowupRepairPanel({
  issues,
  onStart,
  onComplete,
  busyId,
}: {
  issues: IssueWithPart[];
  onStart: (issue: IssueWithPart) => void;
  onComplete: (issue: IssueWithPart) => void;
  busyId?: string | null;
}) {
  const repairable = issues.filter(
    (i) => i.status === "approved" || i.repairState === "completed"
  );

  if (repairable.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucune réparation à effectuer — les signalements doivent être validés et les pièces
        reçues.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {repairable.map((issue) => {
        const photos = issuePhotoUrls(issue);
        const duration = formatDuration(
          repairDurationMinutes(issue.repair_started_at, issue.repair_completed_at)
        );

        return (
          <div
            key={issue.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {issue.checklist_label ?? "Signalement"}
                </p>
                <p className="mt-1 text-sm text-slate-800">{issue.problem}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Pièces : {issue.parts_needed}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${repairStateBadgeClass(issue.repairState)}`}
              >
                {REPAIR_STATE_LABELS[issue.repairState]}
              </span>
            </div>

            {issue.part && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">{issue.part.part_name}</p>
                <p className="text-slate-600">
                  Statut : {PART_STATUS_LABELS[issue.part.status] ?? issue.part.status}
                  {issue.part.supplier && ` · ${issue.part.supplier}`}
                  {issue.part.unit_price != null &&
                    ` · ${formatEuro(issue.part.unit_price)}`}
                </p>
              </div>
            )}

            {(issue.repair_started_at || issue.repair_completed_at) && (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Début</p>
                  <p className="font-medium">{formatRepairDate(issue.repair_started_at)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Fin</p>
                  <p className="font-medium">{formatRepairDate(issue.repair_completed_at)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Durée</p>
                  <p className="font-medium">{duration ?? "—"}</p>
                </div>
              </div>
            )}

            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                    <img
                      src={src}
                      alt="Photo"
                      className="aspect-square rounded-lg border object-cover"
                    />
                  </a>
                ))}
              </div>
            )}

            {issue.repairState === "ready" && (
              <button
                type="button"
                disabled={busyId === issue.id}
                onClick={() => onStart(issue)}
                className="btn-primary-block mt-4 !min-h-10 text-sm"
              >
                {busyId === issue.id
                  ? "Enregistrement…"
                  : "Commencer la réparation manuelle"}
              </button>
            )}

            {issue.repairState === "in_progress" && (
              <button
                type="button"
                disabled={busyId === issue.id}
                onClick={() => onComplete(issue)}
                className="btn-primary-block mt-4 !min-h-10 bg-emerald-700 text-sm hover:bg-emerald-800"
              >
                {busyId === issue.id ? "Enregistrement…" : "Réparation terminée"}
              </button>
            )}

            {issue.repairState === "waiting_parts" && issue.status === "approved" && (
              <p className="mt-3 text-sm text-amber-800">
                En attente de réception des pièces par le magasinier.
              </p>
            )}

            {issue.status === "pending_manager" && (
              <p className="mt-3 text-sm text-amber-800">
                {ISSUE_STATUS_LABELS.pending_manager}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
