"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { IssueCategoryPicker } from "@/components/IssueCategoryPicker";
import { PhotoUpload } from "@/components/PhotoUpload";
import type { IssueCategory } from "@/lib/constants";
import { getPublicUrl } from "@/lib/supabase";
import type { ChecklistItemIssue } from "@/lib/reconditioning-checklist";

export function ChecklistIssueModal({
  itemLabel,
  initialIssue,
  photoPrefix,
  onSave,
  onClose,
}: {
  itemLabel: string;
  initialIssue?: ChecklistItemIssue;
  photoPrefix: string;
  onSave: (issue: ChecklistItemIssue) => void;
  onClose: () => void;
}) {
  const [problem, setProblem] = useState(initialIssue?.problem ?? "");
  const [partsNeeded, setPartsNeeded] = useState(initialIssue?.partsNeeded ?? "");
  const [problemCategory, setProblemCategory] = useState<IssueCategory | null>(
    initialIssue?.problemCategory ?? null
  );
  const [photoPaths, setPhotoPaths] = useState<string[]>(initialIssue?.photoPaths ?? []);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    setError("");
    if (!problem.trim()) {
      setError("Décrivez le problème constaté.");
      return;
    }
    if (photoPaths.length === 0) {
      setError("Ajoutez au moins une photo.");
      return;
    }
    if (!partsNeeded.trim()) {
      setError("Indiquez les pièces nécessaires (ou « aucune »).");
      return;
    }
    if (!problemCategory) {
      setError("Précisez s'il s'agit d'un problème mécanique ou carrosserie.");
      return;
    }
    onSave({
      problem: problem.trim(),
      photoPaths,
      partsNeeded: partsNeeded.trim(),
      problemCategory,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-panel max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="issue-modal-title" className="section-title">
          Signalement — {itemLabel}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Les 4 champs sont obligatoires pour enregistrer.
        </p>

        <div className="mt-4 space-y-4">
          <IssueCategoryPicker
            value={problemCategory}
            onChange={setProblemCategory}
          />

          <label className="label-field">
            Quel est le problème ?
            <textarea
              className="input-field mt-1.5 resize-y"
              rows={3}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Décrivez le défaut ou l'anomalie…"
            />
          </label>

          <div>
            <p className="label-field mb-1.5">Prendre une photo</p>
            <PhotoUpload
              bucket="diagnostic-photos"
              pathPrefix={photoPrefix}
              label="Photo du problème"
              multiple
              onUploaded={(paths) => setPhotoPaths((prev) => [...prev, ...paths])}
            />
            {photoPaths.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photoPaths.map((path) => (
                  <img
                    key={path}
                    src={getPublicUrl("diagnostic-photos", path)}
                    alt="Photo signalement"
                    className="aspect-square rounded-lg border border-slate-200 object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <label className="label-field">
            Quelles pièces sont nécessaires ?
            <textarea
              className="input-field mt-1.5 resize-y"
              rows={2}
              value={partsNeeded}
              onChange={(e) => setPartsNeeded(e.target.value)}
              placeholder="Référence, quantité… ou « aucune »"
            />
          </label>

          {error && <Alert variant="error">{error}</Alert>}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button type="button" onClick={handleSave} className="btn-primary-block flex-1">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
