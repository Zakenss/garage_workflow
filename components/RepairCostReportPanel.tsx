"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import {
  buildRepairCostReportData,
  canViewRepairCostReport,
  fetchStoredRepairCostReport,
  generateAndStoreRepairCostReport,
  openRepairCostReportHtml,
} from "@/lib/repair-cost-report";
import type { SessionUser } from "@/lib/types";

export function RepairCostReportPanel({
  vehicleId,
  repairCompletedAt,
  user,
}: {
  vehicleId: string;
  repairCompletedAt: string | null;
  user: SessionUser;
}) {
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const allowed = canViewRepairCostReport(user.role);

  async function loadStored() {
    const doc = await fetchStoredRepairCostReport(vehicleId);
    setStoredUrl(doc?.url ?? null);
    setGeneratedAt((doc?.generated_at as string) ?? null);
  }

  useEffect(() => {
    if (!allowed || !repairCompletedAt) return;
    loadStored();
  }, [vehicleId, repairCompletedAt, allowed]);

  if (!allowed || !repairCompletedAt) return null;

  async function handleView() {
    setError("");
    if (storedUrl) {
      window.open(storedUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const data = await buildRepairCostReportData(vehicleId);
    if (!data) {
      setError("Impossible de construire le rapport.");
      return;
    }
    openRepairCostReportHtml(data);
  }

  async function handleDownload() {
    setError("");
    const url = storedUrl;
    if (!url) {
      setError("Générez d'abord le rapport.");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-reparation-${vehicleId}.html`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  async function handleRegenerate() {
    setBusy(true);
    setError("");
    try {
      const result = await generateAndStoreRepairCostReport(vehicleId, user, {
        regenerate: true,
      });
      if (!result) {
        setError("Données de réparation insuffisantes.");
        return;
      }
      setStoredUrl(result.url);
      setGeneratedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la régénération.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-padded space-y-3">
      <h2 className="section-title">Rapport coût réparation</h2>
      {generatedAt && (
        <p className="text-sm text-slate-600">
          Dernière génération :{" "}
          {new Date(generatedAt).toLocaleString("fr-FR", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
      {!storedUrl && (
        <Alert variant="warning">
          Aucun rapport enregistré. Utilisez « Régénérer » pour créer le document.
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={handleView}>
          Voir le rapport
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleDownload}
          disabled={!storedUrl}
        >
          Télécharger
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={handleRegenerate}
        >
          {busy ? "Génération…" : storedUrl ? "Régénérer" : "Générer"}
        </button>
      </div>
    </section>
  );
}
