"use client";

import { useState } from "react";
import { PartRepairChoiceModal } from "@/components/PartRepairChoiceModal";
import {
  PartStatusPicker,
  STOREKEEPER_FLOW_STATUSES,
} from "@/components/PartStatusPicker";
import { PART_STATUS_LABELS } from "@/lib/constants";
import { canStorekeeperOrderParts } from "@/lib/parts-approval";
import {
  markPartForReplacement,
  partStatusDetailLabel,
  routePartToBodyworkRepair,
  setStorekeeperPartStatus,
} from "@/lib/part-repair-routing";
import type { PartStatus } from "@/lib/constants";
import type { PartsListStatus } from "@/lib/types";
import { useSession } from "@/lib/session-context";

type PartRow = {
  id: string;
  part_name: string;
  status: string;
  repair_action?: string | null;
};

export function StorekeeperPartStatusControls({
  part,
  licensePlate,
  partsListStatus,
  disabled,
  onUpdated,
}: {
  part: PartRow;
  licensePlate: string;
  partsListStatus?: PartsListStatus | null;
  disabled?: boolean;
  onUpdated: (result?: { allReady?: boolean }) => void | Promise<void>;
}) {
  const user = useSession();
  const [showRepairChoice, setShowRepairChoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const detail = partStatusDetailLabel(part.status, part.repair_action);
  const orderingAllowed = canStorekeeperOrderParts(partsListStatus);
  const allowedStatuses = STOREKEEPER_FLOW_STATUSES.filter(
    (s) => s !== "ordered" || orderingAllowed
  );

  async function handleStatusChange(status: PartStatus) {
    if (!user) return;
    if (status === "to_repair") {
      setError("");
      setShowRepairChoice(true);
      return;
    }
    if (!orderingAllowed && status === "ordered") {
      setError("Liste pièces non validée par le chef d'atelier.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { allReady } = await setStorekeeperPartStatus(part.id, status, user);
      await onUpdated({ allReady });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReplace() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await markPartForReplacement(part.id, user);
      setShowRepairChoice(false);
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBodywork() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await routePartToBodyworkRepair(part.id, user);
      setShowRepairChoice(false);
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (part.status === "received" || part.status === "ready_for_mechanic") {
    return (
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">Statut</p>
        <p className="text-sm font-medium text-slate-800">
          {PART_STATUS_LABELS[part.status] ?? part.status}
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">Statut commande</p>
        {detail && (
          <p className="mb-2 text-xs font-medium text-violet-800">{detail}</p>
        )}
        {!orderingAllowed && (
          <p className="mb-2 text-xs text-amber-800">
            Commande bloquée — soumettez la liste au chef d&apos;atelier.
          </p>
        )}
        <PartStatusPicker
          status={part.status}
          disabled={disabled || busy}
          allowedStatuses={allowedStatuses}
          onChange={handleStatusChange}
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {part.status === "to_repair" && (
          <p className="mt-2 text-xs text-slate-500">
            {part.repair_action === "bodywork"
              ? "Le carrossier a été notifié avec l'immatriculation du véhicule."
              : part.repair_action === "replace"
                ? "Remplacez la pièce puis passez le statut à « Commandée »."
                : PART_STATUS_LABELS.to_repair}
          </p>
        )}
      </div>

      {showRepairChoice && (
        <PartRepairChoiceModal
          partName={part.part_name}
          licensePlate={licensePlate}
          busy={busy}
          error={error}
          onReplace={handleReplace}
          onBodywork={handleBodywork}
          onClose={() => {
            if (!busy) {
              setShowRepairChoice(false);
              setError("");
            }
          }}
        />
      )}
    </>
  );
}
