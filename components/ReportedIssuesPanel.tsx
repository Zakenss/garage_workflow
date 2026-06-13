"use client";

import { useState } from "react";
import { PhotoUpload } from "@/components/PhotoUpload";
import { getPublicUrl } from "@/lib/supabase";
import {
  ISSUE_STATUS_LABELS,
  issuePhotoUrls,
  type MechanicReportedIssue,
} from "@/lib/mechanic-issues";

export function ReportedIssuesPanel({
  issues,
  showActions,
  onApprove,
  onReject,
  busyId,
}: {
  issues: MechanicReportedIssue[];
  showActions?: "manager";
  onApprove?: (issue: MechanicReportedIssue) => void;
  onReject?: (issue: MechanicReportedIssue) => void;
  busyId?: string | null;
}) {
  if (issues.length === 0) {
    return (
      <p className="text-sm text-slate-500">Aucun problème signalé pour ce véhicule.</p>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => {
        const photos = issuePhotoUrls(issue);
        return (
          <div
            key={issue.id}
            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {issue.checklist_label ?? "Signalement"}
                </p>
                {issue.source === "followup" && (
                  <p className="text-xs text-amber-700">Signalement complémentaire</p>
                )}
                <p className="mt-2 text-sm text-slate-800">
                  <span className="font-medium">Problème :</span> {issue.problem}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-medium">Pièces :</span> {issue.parts_needed}
                </p>
                {issue.mechanic && (
                  <p className="mt-1 text-xs text-slate-500">
                    Par {issue.mechanic.full_name} ·{" "}
                    {new Date(issue.created_at).toLocaleString("fr-FR")}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  issue.status === "pending_manager"
                    ? "bg-amber-100 text-amber-900"
                    : issue.status === "approved"
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {ISSUE_STATUS_LABELS[issue.status]}
              </span>
            </div>

            {photos.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Photos ({photos.length})
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {photos.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                      <img
                        src={src}
                        alt="Photo signalement"
                        className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {showActions === "manager" && issue.status === "pending_manager" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === issue.id}
                  onClick={() => onApprove?.(issue)}
                  className="btn-primary-block !min-h-9 !w-auto !px-4 text-sm"
                >
                  Valider → magasinier
                </button>
                <button
                  type="button"
                  disabled={busyId === issue.id}
                  onClick={() => onReject?.(issue)}
                  className="btn-secondary !min-h-9 text-sm"
                >
                  Refuser
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AddFollowupIssueForm({
  photoPrefix,
  onSubmit,
  submitting,
}: {
  photoPrefix: string;
  onSubmit: (data: {
    problem: string;
    partsNeeded: string;
    photoPaths: string[];
  }) => Promise<void>;
  submitting?: boolean;
}) {
  const [problem, setProblem] = useState("");
  const [partsNeeded, setPartsNeeded] = useState("");
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!problem.trim()) {
      setError("Décrivez le problème.");
      return;
    }
    if (photoPaths.length === 0) {
      setError("Ajoutez au moins une photo.");
      return;
    }
    if (!partsNeeded.trim()) {
      setError("Indiquez les pièces nécessaires.");
      return;
    }
    await onSubmit({
      problem: problem.trim(),
      partsNeeded: partsNeeded.trim(),
      photoPaths,
    });
    setProblem("");
    setPartsNeeded("");
    setPhotoPaths([]);
  }

  return (
    <form onSubmit={handleSubmit} className="card-padded space-y-4">
      <h3 className="section-title">Ajouter un problème oublié</h3>
      <p className="text-sm text-slate-500">
        Envoyé au chef d&apos;atelier pour validation avant commande magasin.
      </p>

      <label className="label-field">
        Quel est le problème ?
        <textarea
          className="input-field mt-1.5 resize-y"
          rows={3}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
        />
      </label>

      <div>
        <p className="label-field mb-1.5">Photos</p>
        <PhotoUpload
          bucket="diagnostic-photos"
          pathPrefix={photoPrefix}
          label="Photo du problème"
          multiple
          onUploaded={(paths) => setPhotoPaths((p) => [...p, ...paths])}
        />
        {photoPaths.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photoPaths.map((path) => (
              <img
                key={path}
                src={getPublicUrl("diagnostic-photos", path)}
                alt="Aperçu"
                className="aspect-square rounded-lg border object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <label className="label-field">
        Pièces nécessaires
        <textarea
          className="input-field mt-1.5 resize-y"
          rows={2}
          value={partsNeeded}
          onChange={(e) => setPartsNeeded(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary-block">
        {submitting ? "Envoi…" : "Envoyer au chef d'atelier"}
      </button>
    </form>
  );
}
