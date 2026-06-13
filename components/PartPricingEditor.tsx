"use client";

import { useState } from "react";
import { formatEuro, savePartPricing, type PartCostLine } from "@/lib/parts-costs";

const STATUS_LABELS: Record<string, string> = {
  in_stock: "En stock",
  to_order: "À commander",
  ordered: "Commandée",
  received: "Reçue",
};

export function PartPricingEditor({
  part,
  onSaved,
}: {
  part: PartCostLine;
  onSaved: () => void;
}) {
  const [supplier, setSupplier] = useState(part.supplier ?? "");
  const [unitPrice, setUnitPrice] = useState(
    part.unit_price != null ? String(part.unit_price) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    const price = parseFloat(unitPrice.replace(",", "."));
    if (!supplier.trim()) {
      setError("Indiquez le nom du fournisseur.");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError("Indiquez un prix unitaire valide.");
      return;
    }
    setSaving(true);
    try {
      await savePartPricing(part.id, supplier, price);
      onSaved();
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const previewTotal = lineTotal(
    part.quantity,
    parseFloat(unitPrice.replace(",", ".")) || null
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-slate-900">{part.part_name}</p>
          <p className="text-sm text-slate-500">
            Qté {part.quantity} · {STATUS_LABELS[part.status] ?? part.status}
          </p>
        </div>
        {part.lineTotal > 0 && (
          <p className="text-sm font-semibold text-slate-900">
            {formatEuro(part.lineTotal)}
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="label-field text-xs">
          Fournisseur
          <input
            type="text"
            className="input-field mt-1 !min-h-9 text-sm"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Nom du fournisseur"
          />
        </label>
        <label className="label-field text-xs">
          Prix unitaire (€)
          <input
            type="number"
            step="0.01"
            min="0"
            className="input-field mt-1 !min-h-9 text-sm"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0.00"
          />
        </label>
      </div>

      {!Number.isNaN(previewTotal) && unitPrice && (
        <p className="mt-2 text-xs text-slate-600">
          Total ligne : {formatEuro(previewTotal)}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-secondary mt-3 !min-h-9 w-full text-sm sm:w-auto"
      >
        {saving ? "Enregistrement…" : "Enregistrer fournisseur & prix"}
      </button>
    </div>
  );
}

function lineTotal(quantity: number, unitPrice: number | null): number {
  if (unitPrice == null || Number.isNaN(unitPrice)) return 0;
  return quantity * unitPrice;
}

export function VehicleCostSummary({
  totalCost,
  pricedCount,
  partsCount,
}: {
  totalCost: number;
  pricedCount: number;
  partsCount: number;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
      <p className="text-sm font-medium text-emerald-900">
        Coût total pièces : {formatEuro(totalCost)}
      </p>
      <p className="text-xs text-emerald-800">
        {pricedCount} / {partsCount} pièce(s) avec prix renseigné
      </p>
    </div>
  );
}

export function VehicleCostsCard({
  group,
  defaultOpen,
}: {
  group: import("@/lib/parts-costs").VehiclePartsCost;
  defaultOpen?: boolean;
}) {
  return (
    <details className="card-padded group" open={defaultOpen}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">{group.vehicle.license_plate}</p>
            <p className="text-sm text-slate-600">
              {group.vehicle.make} {group.vehicle.model}
            </p>
          </div>
          <p className="text-lg font-bold text-slate-900">{formatEuro(group.totalCost)}</p>
        </div>
      </summary>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="pb-2 pr-2">Pièce</th>
              <th className="pb-2 pr-2">Fournisseur</th>
              <th className="pb-2 pr-2">Qté</th>
              <th className="pb-2 pr-2">P.U.</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {group.parts.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="py-2 pr-2">{p.part_name}</td>
                <td className="py-2 pr-2 text-slate-600">{p.supplier ?? "—"}</td>
                <td className="py-2 pr-2">{p.quantity}</td>
                <td className="py-2 pr-2">
                  {p.unit_price != null ? formatEuro(p.unit_price) : "—"}
                </td>
                <td className="py-2 text-right font-medium">
                  {p.lineTotal > 0 ? formatEuro(p.lineTotal) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right font-semibold">
                Total véhicule
              </td>
              <td className="pt-3 text-right text-lg font-bold">
                {formatEuro(group.totalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}
