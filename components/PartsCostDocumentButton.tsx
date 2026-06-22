"use client";

import {
  buildPartsCostDocumentData,
  canGeneratePartsCostDocument,
  openPartsCostDocument,
  type PartsCostDocumentData,
} from "@/lib/parts-cost-document";
import type { PartCostLine } from "@/lib/parts-costs";
import type { VehicleStatus } from "@/lib/types";

type VehicleInfo = {
  id: string;
  license_plate: string;
  make: string;
  model: string;
  status: VehicleStatus;
};

export function PartsCostDocumentButton({
  vehicle,
  parts,
  className = "",
  compact,
}: {
  vehicle: VehicleInfo;
  parts: PartCostLine[];
  className?: string;
  compact?: boolean;
}) {
  const canGenerate = canGeneratePartsCostDocument(parts);

  function handleGenerate() {
    if (!canGenerate) return;
    const data: PartsCostDocumentData = buildPartsCostDocumentData({
      vehicle,
      parts,
      totalCost: parts.reduce(
        (sum, p) => sum + (p.lineTotal > 0 ? p.lineTotal : 0),
        0
      ),
      pricedCount: parts.filter((p) => p.unit_price != null && p.unit_price > 0)
        .length,
      partsCount: parts.length,
    });
    try {
      openPartsCostDocument(data);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Impossible de générer le document."
      );
    }
  }

  if (!canGenerate) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleGenerate();
      }}
      className={
        className ||
        (compact
          ? "btn-secondary !min-h-8 shrink-0 !px-3 text-xs"
          : "btn-secondary !min-h-9 text-sm")
      }
      title="Générer le récapitulatif des pièces commandées avec prix et total"
    >
      {compact ? "Coût pièces" : "Générer document coût pièces"}
    </button>
  );
}
