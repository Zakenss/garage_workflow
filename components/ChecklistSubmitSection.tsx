"use client";

import { Alert } from "@/components/Alert";
import { SignaturePad } from "@/components/SignaturePad";
import type { ChecklistSubmitSummary } from "@/lib/reconditioning-checklist";

export function ChecklistSubmitSection({
  summary,
  signature,
  onSignature,
  signedAt,
  onSubmit,
  submitting,
  error,
}: {
  summary: ChecklistSubmitSummary;
  signature: string | null;
  onSignature: (dataUrl: string) => void;
  signedAt: string | null;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string;
}) {
  const { progress, unchecked, issues } = summary;
  const pct =
    progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;

  if (signedAt) {
    return (
      <div className="card-padded mt-6 border-emerald-200 bg-emerald-50/60">
        <p className="font-semibold text-emerald-900">Check-list soumise</p>
        <p className="mt-1 text-sm text-emerald-800">
          Signée et envoyée le{" "}
          {new Date(signedAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
          {issues.length > 0 &&
            ` · ${issues.length} signalement${issues.length > 1 ? "s" : ""} transmis`}
        </p>
      </div>
    );
  }

  return (
    <div className="card-padded mt-6 space-y-5 border-slate-200">
      <div>
        <h2 className="section-title">Soumettre la check-list</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vérifiez que vous n&apos;avez rien oublié avant de signer et d&apos;envoyer les
          signalements au chef d&apos;atelier et au magasinier.
        </p>
      </div>

      {unchecked.length > 0 && (
        <Alert variant="warning">
          <p className="font-medium">
            {unchecked.length} point{unchecked.length > 1 ? "s" : ""} non coché
            {unchecked.length > 1 ? "s" : ""} ({pct}% complété)
          </p>
          <p className="mt-1 text-sm">
            Avez-vous oublié quelque chose ? Pensez notamment à la section{" "}
            <strong>Points souvent oubliés (SAV)</strong>.
          </p>
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-sm">
            {unchecked.slice(0, 8).map((u) => (
              <li key={`${u.sectionTitle}-${u.label}`} className="text-slate-700">
                · {u.label}
              </li>
            ))}
            {unchecked.length > 8 && (
              <li className="text-slate-500">… et {unchecked.length - 8} autres</li>
            )}
          </ul>
        </Alert>
      )}

      {issues.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm font-semibold text-amber-950">
            {issues.length} signalement{issues.length > 1 ? "s" : ""} à transmettre
          </p>
          <ul className="mt-2 space-y-2">
            {issues.map((issue) => (
              <li
                key={`${issue.sectionTitle}-${issue.itemLabel}`}
                className="rounded-lg bg-white/80 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-900">{issue.itemLabel}</p>
                <p className="text-slate-700">{issue.problem}</p>
                <p className="text-slate-600">
                  Pièces : {issue.partsNeeded}
                  {issue.photoCount > 0 &&
                    ` · ${issue.photoCount} photo${issue.photoCount > 1 ? "s" : ""}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Aucun signalement (!) enregistré. Si un problème a été détecté, utilisez le
          bouton <strong>!</strong> sur la ligne concernée.
        </p>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Signature électronique</h3>
        <SignaturePad onSave={onSignature} />
        {signature && (
          <Alert variant="success" className="mt-3">
            Signature enregistrée — prête pour la soumission
          </Alert>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <button
        type="button"
        disabled={submitting || !signature}
        onClick={onSubmit}
        className="btn-primary-block !min-h-12"
      >
        {submitting
          ? "Envoi en cours…"
          : "Soumettre la check-list et envoyer les signalements"}
      </button>
      {!signature && (
        <p className="text-center text-xs text-slate-500">
          Enregistrez votre signature avant de soumettre.
        </p>
      )}
    </div>
  );
}
