import { addTimeline } from "./db";
import { formatEuro, lineTotal } from "./parts-costs";
import { getPublicUrl, supabase } from "./supabase";
import type { SessionUser, UserRole } from "./types";
import { repairDurationMinutes } from "./followup-repair";

const REPORT_ROLES: UserRole[] = [
  "secretary",
  "workshop_manager",
  "storekeeper",
  "admin",
];

export function canViewRepairCostReport(role: UserRole): boolean {
  return REPORT_ROLES.includes(role);
}

export type RepairCostReportData = {
  vehicle: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    vin: string | null;
    client_name: string | null;
    repair_completed_at: string | null;
    repair_started_at: string | null;
  };
  repairReference: string;
  parts: {
    part_name: string;
    quantity: number;
    unit_price: number | null;
    lineTotal: number;
  }[];
  partsTotal: number;
  labourHours: number;
  labourRate: number;
  labourTotal: number;
  grandTotal: number;
  mechanicName: string | null;
  managerName: string | null;
  generatedAt: Date;
};

export async function fetchLabourHourlyRate(): Promise<number> {
  const { data } = await supabase
    .from("workshop_settings")
    .select("value")
    .eq("key", "labour_hourly_rate")
    .maybeSingle();
  const n = parseFloat(data?.value ?? "55");
  return Number.isNaN(n) ? 55 : n;
}

export async function buildRepairCostReportData(
  vehicleId: string
): Promise<RepairCostReportData | null> {
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select(
      "id, license_plate, make, model, vin, client_name, repair_completed_at, repair_started_at, assigned_mechanic_id"
    )
    .eq("id", vehicleId)
    .single();

  if (!vehicle?.repair_completed_at) return null;

  const { data: partsRows } = await supabase
    .from("parts")
    .select("part_name, quantity, unit_price")
    .eq("vehicle_id", vehicleId)
    .order("part_name");

  const parts = (partsRows ?? []).map((p) => {
    const qty = Number(p.quantity);
    const unit = p.unit_price != null ? Number(p.unit_price) : null;
    const total = lineTotal(qty, unit);
    return {
      part_name: p.part_name,
      quantity: qty,
      unit_price: unit,
      lineTotal: total,
    };
  });

  const partsTotal = parts.reduce((s, p) => s + p.lineTotal, 0);

  let labourMinutes = repairDurationMinutes(
    vehicle.repair_started_at,
    vehicle.repair_completed_at
  );

  if (labourMinutes == null) {
    const { data: issues } = await supabase
      .from("mechanic_reported_issues")
      .select("repair_started_at, repair_completed_at")
      .eq("vehicle_id", vehicleId);
    let sum = 0;
    for (const i of issues ?? []) {
      const m = repairDurationMinutes(i.repair_started_at, i.repair_completed_at);
      if (m != null) sum += m;
    }
    labourMinutes = sum > 0 ? sum : 60;
  }

  const labourHours = Math.round((labourMinutes / 60) * 100) / 100;
  const labourRate = await fetchLabourHourlyRate();
  const labourTotal = Math.round(labourHours * labourRate * 100) / 100;

  let mechanicName: string | null = null;
  if (vehicle.assigned_mechanic_id) {
    const { data: mech } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", vehicle.assigned_mechanic_id)
      .maybeSingle();
    mechanicName = mech?.full_name ?? null;
  }

  let managerName: string | null = null;
  const { data: finalCheck } = await supabase
    .from("final_checklists")
    .select("validated_by, users!validated_by(full_name)")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  const validator = finalCheck?.users;
  if (validator) {
    managerName = Array.isArray(validator)
      ? (validator[0] as { full_name: string })?.full_name
      : (validator as { full_name: string }).full_name;
  }
  if (!managerName) {
    const { data: mgr } = await supabase
      .from("users")
      .select("full_name")
      .eq("role", "workshop_manager")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    managerName = mgr?.full_name ?? null;
  }

  const completed = new Date(vehicle.repair_completed_at);
  const repairReference = `REP-${vehicle.license_plate.replace(/\s/g, "")}-${completed.getFullYear()}${String(completed.getMonth() + 1).padStart(2, "0")}${String(completed.getDate()).padStart(2, "0")}`;

  return {
    vehicle: {
      id: vehicle.id,
      license_plate: vehicle.license_plate,
      make: vehicle.make,
      model: vehicle.model,
      vin: vehicle.vin,
      client_name: vehicle.client_name,
      repair_completed_at: vehicle.repair_completed_at,
      repair_started_at: vehicle.repair_started_at,
    },
    repairReference,
    parts,
    partsTotal,
    labourHours,
    labourRate,
    labourTotal,
    grandTotal: partsTotal + labourTotal,
    mechanicName,
    managerName,
    generatedAt: new Date(),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildRepairCostReportHtml(data: RepairCostReportData): string {
  const v = data.vehicle;
  const dateStr = data.generatedAt.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const completedStr = v.repair_completed_at
    ? new Date(v.repair_completed_at).toLocaleString("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "—";

  const partRows = data.parts
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

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport coût réparation — ${escapeHtml(v.license_plate)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #0f172a; line-height: 1.5; }
    h1 { font-size: 1.35rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1rem; margin: 1.5rem 0 0.5rem; }
    .meta { color: #475569; font-size: 0.9rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 0.5rem; }
    th, td { border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: left; }
    th { background: #f1f5f9; }
    td.num { text-align: right; }
    tfoot td { font-weight: 700; background: #f8fafc; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 2rem; font-size: 0.9rem; }
    @media print { body { margin: 1rem; } }
  </style>
</head>
<body>
  <h1>Rapport de coût de réparation</h1>
  <p class="meta">Généré le ${escapeHtml(dateStr)}</p>

  <h2>Véhicule</h2>
  <div class="grid">
    <div><strong>Immatriculation</strong><br />${escapeHtml(v.license_plate)}</div>
    <div><strong>VIN</strong><br />${escapeHtml(v.vin ?? "—")}</div>
    <div><strong>Modèle</strong><br />${escapeHtml(v.make)} ${escapeHtml(v.model)}</div>
    <div><strong>Client</strong><br />${escapeHtml(v.client_name ?? "—")}</div>
    <div><strong>Référence réparation</strong><br />${escapeHtml(data.repairReference)}</div>
    <div><strong>Date fin réparation</strong><br />${escapeHtml(completedStr)}</div>
    <div><strong>Mécanicien</strong><br />${escapeHtml(data.mechanicName ?? "—")}</div>
    <div><strong>Chef d'atelier</strong><br />${escapeHtml(data.managerName ?? "—")}</div>
  </div>

  <h2>Pièces détachées</h2>
  <table>
    <thead><tr><th>Pièce</th><th class="num">Qté</th><th class="num">Prix achat</th><th class="num">Total</th></tr></thead>
    <tbody>${partRows || '<tr><td colspan="4">Aucune pièce</td></tr>'}</tbody>
    <tfoot><tr><td colspan="3" style="text-align:right">Total pièces</td><td class="num">${formatEuro(data.partsTotal)}</td></tr></tfoot>
  </table>

  <h2>Main d'œuvre</h2>
  <table>
    <tbody>
      <tr><td>Heures travaillées</td><td class="num">${data.labourHours} h</td></tr>
      <tr><td>Taux horaire</td><td class="num">${formatEuro(data.labourRate)} / h</td></tr>
      <tr><td><strong>Total main d'œuvre</strong></td><td class="num"><strong>${formatEuro(data.labourTotal)}</strong></td></tr>
    </tbody>
  </table>

  <h2>Totaux</h2>
  <table>
    <tfoot>
      <tr><td>Total pièces</td><td class="num">${formatEuro(data.partsTotal)}</td></tr>
      <tr><td>Total main d'œuvre</td><td class="num">${formatEuro(data.labourTotal)}</td></tr>
      <tr><td><strong>Total général</strong></td><td class="num"><strong>${formatEuro(data.grandTotal)}</strong></td></tr>
    </tfoot>
  </table>
  <script>window.onload = function() { /* optional: window.print(); */ }</script>
</body>
</html>`;
}

export async function fetchStoredRepairCostReport(vehicleId: string) {
  const { data } = await supabase
    .from("vehicle_documents")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("document_type", "repair_cost_report")
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    url: getPublicUrl("vehicle-documents", data.storage_path as string),
  };
}

export async function generateAndStoreRepairCostReport(
  vehicleId: string,
  user: SessionUser | null,
  options?: { regenerate?: boolean }
): Promise<{ url: string; storagePath: string } | null> {
  const data = await buildRepairCostReportData(vehicleId);
  if (!data) return null;

  const html = buildRepairCostReportHtml(data);
  const storagePath = `${vehicleId}/repair-cost-report.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const file = new File([blob], "repair-cost-report.html", { type: "text/html" });

  const { error: uploadError } = await supabase.storage
    .from("vehicle-documents")
    .upload(storagePath, file, { upsert: true, contentType: "text/html" });

  if (uploadError) {
    console.error("generateAndStoreRepairCostReport upload:", uploadError.message);
    throw uploadError;
  }

  const metadata = {
    repairReference: data.repairReference,
    partsTotal: data.partsTotal,
    labourTotal: data.labourTotal,
    grandTotal: data.grandTotal,
  };

  const { error: docError } = await supabase.from("vehicle_documents").upsert(
    {
      vehicle_id: vehicleId,
      document_type: "repair_cost_report",
      storage_path: storagePath,
      generated_at: new Date().toISOString(),
      generated_by: user?.id ?? null,
      metadata,
    },
    { onConflict: "vehicle_id,document_type" }
  );

  if (docError) {
    console.error("generateAndStoreRepairCostReport doc:", docError.message);
    throw docError;
  }

  if (user) {
    await addTimeline(
      vehicleId,
      user.id,
      options?.regenerate ? "repair_cost_report_regenerated" : "repair_cost_report_generated",
      metadata
    );
  }

  return { url: getPublicUrl("vehicle-documents", storagePath), storagePath };
}

export function openRepairCostReportHtml(data: RepairCostReportData): void {
  const html = buildRepairCostReportHtml(data);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) throw new Error("Autorisez les pop-ups pour ouvrir le rapport.");
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
