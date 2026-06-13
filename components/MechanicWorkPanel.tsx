import { StatusBadge } from "@/components/StatusBadge";
import type { MechanicPartRow } from "@/lib/mechanic-work";

import { PART_STATUS_LABELS, PART_STATUSES } from "@/lib/constants";

export function MechanicWorkPanel({
  parts,
  photoUrls,
  canEditStatus,
  onStatusChange,
}: {
  parts: MechanicPartRow[];
  photoUrls: string[];
  canEditStatus?: boolean;
  onStatusChange?: (partId: string, status: string) => void;
}) {
  if (parts.length === 0 && photoUrls.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucune pièce ni photo déposée par le mécanicien pour ce véhicule.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {parts.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Pièces</h4>
          <div className="space-y-2">
            {parts.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{p.part_name}</p>
                    {p.problem && (
                      <p className="mt-1 text-sm text-amber-800">
                        Problème : {p.problem}
                      </p>
                    )}
                    <p className="text-sm text-slate-500">Qté {p.quantity}</p>
                  </div>
                  {!canEditStatus && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {PART_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  )}
                </div>
                {canEditStatus && onStatusChange && !p.id.startsWith("checklist-") && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PART_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onStatusChange(p.id, s)}
                        className={
                          p.status === s ? "btn-chip-active" : "btn-chip-inactive"
                        }
                      >
                        {PART_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {photoUrls.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Photos diagnostic ({photoUrls.length})
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photoUrls.map((src) => (
              <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                <img
                  src={src}
                  alt="Photo diagnostic"
                  className="aspect-square w-full rounded-lg border border-slate-200 object-cover shadow-sm transition-opacity hover:opacity-90"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function VehicleMechanicWorkCard({
  licensePlate,
  make,
  model,
  status,
  parts,
  photoUrls,
  canEditStatus,
  onStatusChange,
  defaultOpen,
}: {
  licensePlate: string;
  make: string;
  model: string;
  status: Parameters<typeof StatusBadge>[0]["status"];
  parts: MechanicPartRow[];
  photoUrls: string[];
  canEditStatus?: boolean;
  onStatusChange?: (partId: string, status: string) => void;
  defaultOpen?: boolean;
}) {
  return (
    <details className="card-padded group" open={defaultOpen}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">{licensePlate}</p>
            <p className="text-sm text-slate-600">
              {make} {model} · {parts.length} pièce(s) · {photoUrls.length} photo(s)
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
      </summary>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <MechanicWorkPanel
          parts={parts}
          photoUrls={photoUrls}
          canEditStatus={canEditStatus}
          onStatusChange={onStatusChange}
        />
      </div>
    </details>
  );
}
