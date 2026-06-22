"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { PartsCostDocumentButton } from "@/components/PartsCostDocumentButton";
import { ReportedIssuesPanel } from "@/components/ReportedIssuesPanel";
import { formatEuro } from "@/lib/parts-costs";
import {
  approvePartsList,
  fetchPendingPartsApprovals,
  rejectPartsList,
  type VehiclePartsApproval,
} from "@/lib/parts-approval";
import { MANAGER_NAV } from "@/lib/manager";
import { fetchVehicleIssues } from "@/lib/mechanic-issues";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";

type PartLine = {
  id: string;
  part_name: string;
  quantity: number;
  unit_price: number | null;
  supplier: string | null;
  status: string;
  repair_action: string | null;
};

export default function PartsApprovalPage() {
  const user = useSession();
  const [pending, setPending] = useState<VehiclePartsApproval[]>([]);
  const [selected, setSelected] = useState<VehiclePartsApproval | null>(null);
  const [parts, setParts] = useState<PartLine[]>([]);
  const [issues, setIssues] = useState<Awaited<ReturnType<typeof fetchVehicleIssues>>>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setPending(await fetchPendingPartsApprovals());
    setLoading(false);
  }

  async function selectVehicle(row: VehiclePartsApproval) {
    setSelected(row);
    setComment("");
    setError("");
    const [{ data: partRows }, issueRows] = await Promise.all([
      supabase
        .from("parts")
        .select("id, part_name, quantity, unit_price, supplier, status, repair_action")
        .eq("vehicle_id", row.vehicle_id)
        .order("part_name"),
      fetchVehicleIssues(row.vehicle_id),
    ]);
    setParts(
      (partRows ?? []).map((p) => ({
        ...p,
        unit_price: p.unit_price != null ? Number(p.unit_price) : null,
      }))
    );
    setIssues(issueRows);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("parts-approval")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function handleApprove() {
    if (!user || !selected) return;
    setBusy(true);
    setError("");
    try {
      await approvePartsList(selected.vehicle_id, user);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!user || !selected) return;
    setBusy(true);
    setError("");
    try {
      await rejectPartsList(selected.vehicle_id, user, comment);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refus impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Validation listes pièces"
        subtitle="Vérifiez les coûts et les éléments carrosserie avant commande magasin"
      />

      {loading ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : !selected ? (
        pending.length === 0 ? (
          <EmptyState
            title="Aucune liste en attente"
            description="Le magasinier soumettra les listes pièces depuis Photos et problèmes."
          />
        ) : (
          <div className="space-y-3">
            {pending.map((row) => (
              <button
                key={row.vehicle_id}
                type="button"
                onClick={() => selectVehicle(row)}
                className="card-interactive w-full text-left"
              >
                <p className="font-semibold">{row.license_plate}</p>
                <p className="text-sm text-slate-600">
                  {row.make} {row.model} · {row.parts_count} pièce
                  {row.parts_count > 1 ? "s" : ""} · {formatEuro(row.total_cost)}
                </p>
                {row.parts_list_submitted_at && (
                  <p className="mt-1 text-xs text-slate-500">
                    Soumise le {new Date(row.parts_list_submitted_at).toLocaleString("fr-FR")}
                  </p>
                )}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-5">
          <button type="button" onClick={() => setSelected(null)} className="btn-secondary">
            ← Retour
          </button>

          <div className="card-padded">
            <h2 className="text-lg font-semibold">{selected.license_plate}</h2>
            <p className="text-sm text-slate-600">
              {selected.make} {selected.model} · Total {formatEuro(selected.total_cost)}
            </p>
          </div>

          {issues.length > 0 && (
            <div className="card-padded">
              <h3 className="section-title mb-3">Signalements mécanicien</h3>
              <ReportedIssuesPanel issues={issues} />
            </div>
          )}

          <div className="card-padded space-y-3">
            <h3 className="section-title">Détail pièces et tarifs</h3>
            {parts.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-medium">{p.part_name}</p>
                <p className="text-slate-600">
                  Qté {p.quantity}
                  {p.supplier && ` · ${p.supplier}`}
                  {p.unit_price != null && ` · ${formatEuro(p.unit_price)} / u`}
                  {p.unit_price != null && ` · ${formatEuro(p.unit_price * p.quantity)}`}
                </p>
                {p.repair_action === "bodywork" && (
                  <p className="mt-1 text-xs text-violet-800">À réparer en carrosserie</p>
                )}
              </div>
            ))}
            <PartsCostDocumentButton
              vehicle={{
                id: selected.vehicle_id,
                license_plate: selected.license_plate,
                make: selected.make,
                model: selected.model,
                status: selected.status as import("@/lib/types").VehicleStatus,
              }}
              parts={parts.map((p) => ({
                id: p.id,
                part_name: p.part_name,
                quantity: p.quantity,
                unit_price: p.unit_price,
                supplier: p.supplier,
                status: p.status,
                repair_action: p.repair_action,
                lineTotal: (p.unit_price ?? 0) * p.quantity,
              }))}
            />
          </div>

          <label className="label-field block">
            Commentaire en cas de refus
            <textarea
              className="input-field mt-1.5 resize-y"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex. : privilégier réparation carrosserie pour l'aile AR…"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              className="btn-primary-block flex-1"
            >
              Valider la liste — autoriser commandes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleReject}
              className="btn-secondary flex-1"
            >
              Refuser avec commentaire
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
