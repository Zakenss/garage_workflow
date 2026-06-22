"use client";

import { useState } from "react";
import { Alert } from "@/components/Alert";
import {
  markAllPartsReadyForMechanic,
  markPartReadyForMechanic,
  recordPartReceipt,
} from "@/lib/parts-orders";
import { useSession } from "@/lib/session-context";

export function PartReceiptControls({
  part,
  onUpdated,
}: {
  part: {
    id: string;
    part_name: string;
    quantity: number;
    quantity_received: number;
    status: string;
  };
  vehicleId?: string;
  onUpdated: (result?: { allReady?: boolean }) => void | Promise<void>;
}) {
  const user = useSession();
  const [qty, setQty] = useState(String(part.quantity_received || part.quantity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canReceive = part.status === "ordered";
  const canMarkReady =
    part.status === "received" && part.quantity_received >= part.quantity;

  async function handleReceive() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const n = parseInt(qty, 10);
      await recordPartReceipt(part.id, n, user);
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réception impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReady() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const { allReady } = await markPartReadyForMechanic(part.id, user);
      await onUpdated({ allReady });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!canReceive && !canMarkReady && part.status !== "ready_for_mechanic") {
    return null;
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3">
      <p className="text-xs font-medium text-slate-600">Réception magasin</p>
      {part.status === "ready_for_mechanic" && (
        <p className="mt-1 text-sm text-emerald-800">Prête pour le mécanicien</p>
      )}
      {canReceive && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            Qté reçue / {part.quantity}
            <input
              type="number"
              min={1}
              max={part.quantity}
              className="input-field mt-1 !min-h-9 !w-24 text-sm"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={handleReceive}
            className="btn-secondary !min-h-9 text-sm"
          >
            Enregistrer réception
          </button>
        </div>
      )}
      {canMarkReady && (
        <button
          type="button"
          disabled={busy}
          onClick={handleReady}
          className="btn-success mt-2 !min-h-9 w-full text-sm"
        >
          Prête pour le mécanicien
        </button>
      )}
      {part.status === "received" && part.quantity_received > 0 && part.quantity_received < part.quantity && (
        <p className="mt-2 text-xs text-amber-800">
          Réception partielle : {part.quantity_received}/{part.quantity}
        </p>
      )}
      {error && (
        <Alert variant="error" className="mt-2 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}

export function MarkAllPartsReadyButton({
  vehicleId,
  parts,
  onUpdated,
}: {
  vehicleId: string;
  parts: { status: string; quantity: number; quantity_received?: number }[];
  onUpdated: (result?: { allReady?: boolean }) => void | Promise<void>;
}) {
  const user = useSession();
  const [busy, setBusy] = useState(false);
  const eligible = parts.filter(
    (p) =>
      p.status === "received" &&
      (p.quantity_received ?? 0) >= p.quantity
  );

  if (eligible.length === 0) return null;

  async function handleAll() {
    if (!user) return;
    setBusy(true);
    try {
      const { allReady } = await markAllPartsReadyForMechanic(vehicleId, user);
      await onUpdated({ allReady });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleAll}
      className="btn-success !min-h-9 w-full text-sm sm:w-auto"
    >
      {busy ? "…" : `Tout marquer prêt mécanicien (${eligible.length})`}
    </button>
  );
}
