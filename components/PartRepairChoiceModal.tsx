"use client";

import { Alert } from "@/components/Alert";

export function PartRepairChoiceModal({
  partName,
  licensePlate,
  busy,
  error,
  onReplace,
  onBodywork,
  onClose,
}: {
  partName: string;
  licensePlate: string;
  busy?: boolean;
  error?: string;
  onReplace: () => void;
  onBodywork: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="part-repair-title"
    >
      <div className="modal-panel max-w-md">
        <h2 id="part-repair-title" className="text-lg font-semibold text-slate-900">
          À réparer — {partName}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Véhicule <strong>{licensePlate}</strong>. Précisez si vous changez la pièce ou si
          le carrossier doit la réparer.
        </p>

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onReplace}
            className="btn-secondary w-full !min-h-11"
          >
            Changer la pièce
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onBodywork}
            className="btn-primary-block w-full"
          >
            Faire réparer par le carrossier
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="btn-ghost w-full text-sm"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
