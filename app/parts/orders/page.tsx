"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { PartPricingEditor } from "@/components/PartPricingEditor";
import { PartStatusPicker } from "@/components/PartStatusPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { PART_STATUS_LABELS } from "@/lib/constants";
import {
  fetchStorekeeperPartOrders,
  updatePartOrderStatus,
  type VehiclePartOrders,
} from "@/lib/parts-orders";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import { useSession } from "@/lib/session-context";
import { supabase } from "@/lib/supabase";

export default function StorekeeperOrdersPage() {
  const user = useSession();
  const [groups, setGroups] = useState<VehiclePartOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPartId, setBusyPartId] = useState<string | null>(null);
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

  async function setStatus(partId: string, status: string, plate: string) {
    setBusyPartId(partId);
    setFeedback("");
    try {
      const { allReceived } = await updatePartOrderStatus(partId, status);
      if (status === "received" && allReceived) {
        setFeedback(
          `Toutes les pièces reçues pour ${plate} — le mécanicien est notifié pour la phase réparation / signalements.`
        );
      }
      await load();
    } finally {
      setBusyPartId(null);
    }
  }

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
        subtitle="Mettez à jour le statut de chaque pièce — « Reçue » notifie le mécanicien et ouvre sa check-list finale"
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
            <details
              key={group.vehicle.id}
              className="card-padded group"
              open={group.pendingCount > 0}
            >
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {group.vehicle.license_plate}
                    </p>
                    <p className="text-sm text-slate-600">
                      {group.vehicle.make} {group.vehicle.model}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={group.vehicle.status} />
                    {group.pendingCount > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {group.pendingCount} en cours
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Toutes reçues
                      </span>
                    )}
                  </div>
                </div>
              </summary>

              <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                {group.parts.map((part) => (
                  <div key={part.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{part.part_name}</p>
                        <p className="text-sm text-slate-500">
                          Qté {part.quantity}
                          {part.supplier && ` · ${part.supplier}`}
                          {" · "}
                          {PART_STATUS_LABELS[part.status] ?? part.status}
                        </p>
                      </div>
                    </div>

                    <PartPricingEditor
                      part={{
                        id: part.id,
                        part_name: part.part_name,
                        quantity: part.quantity,
                        unit_price: part.unit_price,
                        supplier: part.supplier,
                        status: part.status,
                        lineTotal:
                          part.unit_price != null
                            ? part.quantity * part.unit_price
                            : 0,
                      }}
                      onSaved={load}
                    />

                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-600">Statut commande</p>
                      <PartStatusPicker
                        status={part.status}
                        disabled={busyPartId === part.id}
                        onChange={(s) => setStatus(part.id, s, group.vehicle.license_plate)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </AppShell>
  );
}
