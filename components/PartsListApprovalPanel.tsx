"use client";

import { useState } from "react";
import { Alert } from "@/components/Alert";
import {
  PARTS_LIST_STATUS_LABELS,
  canStorekeeperOrderParts,
  submitPartsListForApproval,
  usesPartsApprovalWorkflow,
  type VehiclePartsApproval,
} from "@/lib/parts-approval";
import { formatEuro } from "@/lib/parts-costs";
import type { PartsListStatus } from "@/lib/types";
import { useSession } from "@/lib/session-context";

export function PartsListApprovalPanel({
  approval,
  onUpdated,
}: {
  approval: VehiclePartsApproval;
  onUpdated: () => void | Promise<void>;
}) {
  const user = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!usesPartsApprovalWorkflow(approval.parts_list_status)) {
    return null;
  }

  const status = approval.parts_list_status as NonNullable<PartsListStatus>;
  const canSubmit = status === "draft" || status === "rejected";
  const pricingComplete = approval.priced_count >= approval.parts_count;

  async function handleSubmit() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await submitPartsListForApproval(approval.vehicle_id, user);
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Soumission impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Liste pièces — validation chef d&apos;atelier</p>
          <p className="mt-1 text-sm text-slate-600">
            {PARTS_LIST_STATUS_LABELS[status]}
            {approval.total_cost > 0 && ` · Total ${formatEuro(approval.total_cost)}`}
          </p>
          {status === "rejected" && approval.parts_list_rejection_comment && (
            <Alert variant="error" className="mt-3">
              Refus : {approval.parts_list_rejection_comment}
            </Alert>
          )}
          {!canStorekeeperOrderParts(status) && status !== "rejected" && (
            <p className="mt-2 text-xs text-amber-800">
              Commande bloquée tant que le chef d&apos;atelier n&apos;a pas validé la liste.
            </p>
          )}
        </div>
        {canSubmit && (
          <button
            type="button"
            disabled={busy || !pricingComplete}
            onClick={handleSubmit}
            className="btn-primary-block !w-auto shrink-0 !px-4"
          >
            {busy ? "Envoi…" : "Soumettre au chef d'atelier"}
          </button>
        )}
      </div>
      {!pricingComplete && canSubmit && (
        <p className="mt-2 text-xs text-slate-500">
          Complétez le fournisseur et le prix unitaire de chaque pièce avant soumission.
        </p>
      )}
      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}
    </div>
  );
}
