import { formatEuro, lineTotal, type PartCostLine, type VehiclePartsCost } from "./parts-costs";
import { summarizeVehicleParts } from "./parts-orders";

export type PartsCostDocumentData = {
  vehicle: VehiclePartsCost["vehicle"];
  parts: PartCostLine[];
  totalCost: number;
  generatedAt: Date;
};

export function canGeneratePartsCostDocument(
  parts: { status: string }[]
): boolean {
  if (parts.length === 0) return false;
  const phase = summarizeVehicleParts(parts);
  return phase === "ordered" || phase === "received";
}

export function buildPartsCostDocumentData(
  group: VehiclePartsCost
): PartsCostDocumentData {
  const totalCost = group.parts.reduce(
    (sum, p) => sum + lineTotal(p.quantity, p.unit_price),
    0
  );
  return {
    vehicle: group.vehicle,
    parts: group.parts,
    totalCost,
    generatedAt: new Date(),
  };
}

export function buildPartsCostDocumentHtml(data: PartsCostDocumentData): string {
  const { vehicle, parts, totalCost, generatedAt } = data;
  const dateStr = generatedAt.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const rows = parts
    .map(
      (p) => `
    <tr>
      <td>${escapeHtml(p.part_name)}</td>
      <td class="num">${p.quantity}</td>
      <td class="num">${p.unit_price != null ? formatEuro(p.unit_price) : "—"}</td>
      <td class="num">${p.lineTotal > 0 ? formatEuro(p.lineTotal) : "—"}</td>
    </tr>`
    )
    .join("");

  const pricedCount = parts.filter((p) => p.unit_price != null && p.unit_price > 0).length;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Coût pièces — ${escapeHtml(vehicle.license_plate)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #0f172a;
      margin: 2rem;
      line-height: 1.5;
    }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
    .meta { color: #475569; font-size: 0.9rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5rem 0.65rem; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    td.num { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: 700; background: #f8fafc; }
    .note { margin-top: 1rem; font-size: 0.8rem; color: #64748b; }
    @media print {
      body { margin: 1rem; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Coût de réparation en pièces</h1>
  <p class="meta">
    <strong>${escapeHtml(vehicle.license_plate)}</strong> — ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}<br />
    Document généré le ${escapeHtml(dateStr)}
  </p>
  <table>
    <thead>
      <tr>
        <th>Pièce</th>
        <th class="num">Qté</th>
        <th class="num">Prix unitaire</th>
        <th class="num">Total ligne</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right">Total pièces</td>
        <td class="num">${formatEuro(totalCost)}</td>
      </tr>
    </tfoot>
  </table>
  ${
    pricedCount < parts.length
      ? `<p class="note">${parts.length - pricedCount} pièce(s) sans prix renseigné — complétez les tarifs magasinier pour un total exact.</p>`
      : ""
  }
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openPartsCostDocument(data: PartsCostDocumentData): void {
  const html = buildPartsCostDocumentHtml(data);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    throw new Error("Impossible d'ouvrir la fenêtre d'impression. Autorisez les pop-ups.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
