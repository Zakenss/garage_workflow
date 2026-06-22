"use client";

import { PART_STATUS_LABELS } from "@/lib/constants";
import type { IssuePartInfo } from "@/lib/followup-repair";
import { partStatusDetailLabel } from "@/lib/part-repair-routing";

export function PartsReceiptPanel({
  parts,
  allReceived,
}: {
  parts: IssuePartInfo[];
  allReceived: boolean;
}) {
  if (parts.length === 0) {
    return (
      <p className="text-sm text-slate-500">Aucune pièce enregistrée pour ce véhicule.</p>
    );
  }

  return (
    <div className="card-padded space-y-4">
      <div>
        <h2 className="section-title">Réception des pièces</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vérifiez les pièces reçues du magasinier. Si une pièce manque, utilisez le formulaire
          Signalement complémentaire ci-dessous.
        </p>
      </div>

      <ul className="space-y-2">
        {parts.map((p) => {
          const ready = p.status === "received" || p.status === "in_stock" || p.status === "ready_for_mechanic";
          const detail = partStatusDetailLabel(p.status, p.repair_action);
          const label = detail
            ? `${PART_STATUS_LABELS[p.status] ?? p.status} — ${detail}`
            : (PART_STATUS_LABELS[p.status] ?? p.status);
          return (
          <li
            key={p.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm ${
              ready
                ? "border-emerald-200 bg-emerald-50/60"
                : p.status === "to_repair"
                  ? "border-violet-200 bg-violet-50/60"
                : "border-amber-200 bg-amber-50/60"
            }`}
          >
            <span className="font-medium text-slate-900">{p.part_name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                ready
                  ? "bg-emerald-100 text-emerald-900"
                  : p.status === "to_repair"
                    ? "bg-violet-100 text-violet-900"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {label}
            </span>
          </li>
          );
        })}
      </ul>

      {allReceived ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Toutes les pièces sont reçues — vous pouvez démarrer les réparations ci-dessous ou
          signaler une pièce oubliée.
        </p>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          En attente de réception de certaines pièces par le magasinier.
        </p>
      )}
    </div>
  );
}
