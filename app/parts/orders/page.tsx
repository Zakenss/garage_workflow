"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { PartPricingEditor } from "@/components/PartPricingEditor";
import {
  MarkAllPartsReadyButton,
  PartReceiptControls,
} from "@/components/PartReceiptControls";
import { PartsListApprovalPanel } from "@/components/PartsListApprovalPanel";
import { PartsCostDocumentButton } from "@/components/PartsCostDocumentButton";
import { StorekeeperPartStatusControls } from "@/components/StorekeeperPartStatusControls";
import { StatusBadge } from "@/components/StatusBadge";
import { PART_STATUS_LABELS } from "@/lib/constants";
import {
  fetchStorekeeperPartOrders,
  summarizeVehicleParts,
  PARTS_SUMMARY_LABELS,
  type VehiclePartOrders,
} from "@/lib/parts-orders";
import { fetchVehiclePartsApproval, type VehiclePartsApproval } from "@/lib/parts-approval";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import { useSession } from "@/lib/session-context";
import { supabase } from "@/lib/supabase";

export default function StorekeeperOrdersPage() {
  const user = useSession();
  const [groups, setGroups] = useState<VehiclePartOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setGroups(await fetchStorekeeperPartOrders());
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("storekeeper-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, () =>
        load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  if (!user) return <LoadingPage />;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? groups.filter(
        (g) =>
          g.vehicle.license_plate.toLowerCase().includes(query) ||
          g.vehicle.make.toLowerCase().includes(query) ||
          g.vehicle.model.toLowerCase().includes(query)
      )
    : groups;

  return (
    <AppShell user={user} nav={[...STOREKEEPER_NAV]}>
      <PageHeader
        title="Commandes pièces"
        subtitle="Réception des pièces, validation chef d'atelier et préparation pour le mécanicien"
      />

      <p className="mb-4 text-sm text-slate-600">
        Consultez les signalements initiaux sur{" "}
        <a href="/parts" className="font-medium text-slate-900 underline">
          Photos et problèmes
        </a>
        .
      </p>

      {feedback && (
        <Alert variant="success" className="mb-4">
          {feedback}
        </Alert>
      )}

      <label className="mb-6 block">
        <span className="sr-only">Rechercher par immatriculation</span>
        <input
          type="search"
          className="input-field"
          placeholder="Rechercher par immatriculation, marque…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher par immatriculation"
        />
      </label>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? "Aucun véhicule trouvé" : "Aucune pièce à suivre"}
          description={
            query
              ? "Essayez une autre immatriculation ou effacez la recherche."
              : "Les pièces signalées par les mécaniciens apparaîtront ici après soumission de la check-list."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((group) => (
            <VehicleOrderCard
              key={group.vehicle.id}
              group={group}
              onFeedback={setFeedback}
              onReload={load}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function VehicleOrderCard({
  group,
  onFeedback,
  onReload,
}: {
  group: VehiclePartOrders;
  onFeedback: (msg: string) => void;
  onReload: () => void | Promise<void>;
}) {
  const [approval, setApproval] = useState<VehiclePartsApproval | null>(null);
  const phase = summarizeVehicleParts(group.parts, group.vehicle.parts_list_status);

  useEffect(() => {
    fetchVehiclePartsApproval(group.vehicle.id).then(setApproval);
  }, [group.vehicle.id, group.parts]);

  async function refresh() {
    setApproval(await fetchVehiclePartsApproval(group.vehicle.id));
    await onReload();
  }

  return (
    <details className="card-padded group" open={group.pendingCount > 0}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{group.vehicle.license_plate}</p>
            <p className="text-sm text-slate-600">
              {group.vehicle.make} {group.vehicle.model}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={group.vehicle.status} />
            <PartsCostDocumentButton
              vehicle={group.vehicle}
              parts={group.parts.map((p) => ({
                id: p.id,
                part_name: p.part_name,
                quantity: p.quantity,
                unit_price: p.unit_price,
                supplier: p.supplier,
                status: p.status,
                repair_action: p.repair_action,
                lineTotal: p.unit_price != null ? p.quantity * p.unit_price : 0,
              }))}
              compact
            />
            {phase && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                {PARTS_SUMMARY_LABELS[phase]}
              </span>
            )}
          </div>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        {approval && <PartsListApprovalPanel approval={approval} onUpdated={refresh} />}
        <MarkAllPartsReadyButton
          vehicleId={group.vehicle.id}
          parts={group.parts}
          onUpdated={async (result) => {
            onFeedback("");
            if (result?.allReady) {
              onFeedback(
                `Toutes les pièces prêtes pour ${group.vehicle.license_plate} — le chef d'atelier est notifié pour planification.`
              );
            }
            await refresh();
          }}
        />
        {group.parts.map((part) => (
          <div key={part.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="font-medium text-slate-900">{part.part_name}</p>
            <p className="text-sm text-slate-500">
              Qté {part.quantity}
              {part.supplier && ` · ${part.supplier}`}
              {" · "}
              {PART_STATUS_LABELS[part.status] ?? part.status}
            </p>
            <PartPricingEditor
              part={{
                id: part.id,
                part_name: part.part_name,
                quantity: part.quantity,
                unit_price: part.unit_price,
                supplier: part.supplier,
                status: part.status,
                repair_action: part.repair_action,
                lineTotal:
                  part.unit_price != null ? part.quantity * part.unit_price : 0,
              }}
              onSaved={refresh}
            />
            <StorekeeperPartStatusControls
              part={part}
              licensePlate={group.vehicle.license_plate}
              partsListStatus={group.vehicle.parts_list_status}
              onUpdated={refresh}
            />
            <PartReceiptControls
              part={part}
              vehicleId={group.vehicle.id}
              onUpdated={async (result) => {
                onFeedback("");
                if (result?.allReady) {
                  onFeedback(
                    `Toutes les pièces prêtes — ${group.vehicle.license_plate}. Le chef d'atelier planifiera la réparation.`
                  );
                }
                await refresh();
              }}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
