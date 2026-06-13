"use client";

import { useSession } from "@/lib/session-context";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import {
  PartPricingEditor,
  VehicleCostSummary,
} from "@/components/PartPricingEditor";
import { ReportedIssuesPanel } from "@/components/ReportedIssuesPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { PART_STATUS_LABELS } from "@/lib/constants";
import { MANAGER_NAV } from "@/lib/manager";
import { fetchAllIssuesGrouped, type VehicleIssuesGroup } from "@/lib/mechanic-issues";
import {
  fetchAllVehiclePartCosts,
  formatEuro,
  type VehiclePartsCost,
} from "@/lib/parts-costs";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import { supabase } from "@/lib/supabase";
import { notifyUser } from "@/lib/db";

export default function PartsPage() {
  const user = useSession();
  const [issueGroups, setIssueGroups] = useState<VehicleIssuesGroup[]>([]);
  const [costGroups, setCostGroups] = useState<VehiclePartsCost[]>([]);
  const [loading, setLoading] = useState(true);

  const isStorekeeper = user?.role === "storekeeper";
  const isManager = user?.role === "workshop_manager";

  async function load() {
    const [groups, costs] = await Promise.all([
      fetchAllIssuesGrouped(),
      fetchAllVehiclePartCosts(),
    ]);
    setIssueGroups(groups);
    setCostGroups(costs);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("parts-work")
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, () =>
        load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_reported_issues" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function setPartStatus(vehicleId: string, partId: string, status: string) {
    await supabase.from("parts").update({ status }).eq("id", partId);
    if (status === "received") {
      const { data: v } = await supabase
        .from("vehicles")
        .select("assigned_mechanic_id, license_plate")
        .eq("id", vehicleId)
        .single();
      if (v?.assigned_mechanic_id) {
        await notifyUser(
          v.assigned_mechanic_id,
          "parts_received",
          `Pièces reçues — ${v.license_plate}`,
          vehicleId
        );
      }
    }
    await load();
  }

  if (!user) return <LoadingPage />;

  const nav = isManager ? [...MANAGER_NAV] : [...STOREKEEPER_NAV];

  const vehicleIds = new Set([
    ...issueGroups.map((g) => g.vehicle.id),
    ...costGroups.map((g) => g.vehicle.id),
  ]);

  return (
    <AppShell user={user} nav={nav}>
      <PageHeader
        title="Pièces & signalements mécanicien"
        subtitle={
          isStorekeeper
            ? "Renseignez fournisseur et prix — totaux visibles par le chef d'atelier"
            : "Problèmes et coûts pièces par véhicule"
        }
        action={
          isManager ? (
            <Link href="/parts/costs" className="btn-secondary text-sm">
              Voir tous les coûts →
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : vehicleIds.size === 0 ? (
        <EmptyState
          title="Aucun signalement"
          description="Les pièces signalées par les mécaniciens apparaîtront ici."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(vehicleIds).map((vehicleId) => {
            const issueGroup = issueGroups.find((g) => g.vehicle.id === vehicleId);
            const costGroup = costGroups.find((g) => g.vehicle.id === vehicleId);
            const vehicle = issueGroup?.vehicle ?? costGroup?.vehicle;
            if (!vehicle) return null;

            return (
              <section key={vehicleId} className="card-padded space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{vehicle.license_plate}</p>
                    <p className="text-sm text-slate-600">
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={vehicle.status} />
                    {isManager && costGroup && costGroup.totalCost > 0 && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">
                        {formatEuro(costGroup.totalCost)}
                      </span>
                    )}
                    {isStorekeeper && (
                      <Link
                        href={`/parts/checklist/${vehicleId}`}
                        className="text-sm font-medium text-slate-700 hover:underline"
                      >
                        Check-list →
                      </Link>
                    )}
                  </div>
                </div>

                {costGroup && costGroup.partsCount > 0 && (
                  <VehicleCostSummary
                    totalCost={costGroup.totalCost}
                    pricedCount={costGroup.pricedCount}
                    partsCount={costGroup.partsCount}
                  />
                )}

                {issueGroup && issueGroup.issues.length > 0 && (
                  <ReportedIssuesPanel issues={issueGroup.issues} />
                )}

                {costGroup && costGroup.parts.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="mb-3 text-sm font-semibold text-slate-800">
                      {isStorekeeper
                        ? "Pièces — fournisseur & prix"
                        : "Détail des pièces"}
                    </h4>
                    <div className="space-y-3">
                      {costGroup.parts.map((p) =>
                        isStorekeeper ? (
                          <div key={p.id} className="space-y-2">
                            <PartPricingEditor part={p} onSaved={load} />
                            <div className="flex flex-wrap gap-2 pl-1">
                              {(["in_stock", "to_order", "ordered", "received"] as const).map(
                                (s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setPartStatus(vehicleId, p.id, s)}
                                    className={
                                      p.status === s ? "btn-chip-active" : "btn-chip-inactive"
                                    }
                                  >
                                    {PART_STATUS_LABELS[s]}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"
                          >
                            <div>
                              <p className="font-medium">{p.part_name}</p>
                              <p className="text-slate-500">
                                {p.supplier ?? "Fournisseur non renseigné"} · Qté {p.quantity}
                              </p>
                            </div>
                            <p className="font-semibold">
                              {p.lineTotal > 0 ? formatEuro(p.lineTotal) : "—"}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
