"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { VehicleCostsCard } from "@/components/PartPricingEditor";
import { navForRole } from "@/lib/role-nav";
import { useSession } from "@/lib/session-context";
import {
  fetchAllVehiclePartCosts,
  formatEuro,
  grandTotal,
  type VehiclePartsCost,
} from "@/lib/parts-costs";
import { canGeneratePartsCostDocument } from "@/lib/parts-cost-document";
import { PartsCostDocumentButton } from "@/components/PartsCostDocumentButton";
import { supabase } from "@/lib/supabase";

const COSTS_ROLES = new Set(["admin", "workshop_manager", "secretary", "storekeeper"]);

export default function PartsCostsPage() {
  const user = useSession();
  const [groups, setGroups] = useState<VehiclePartsCost[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setGroups(await fetchAllVehiclePartCosts());
    setLoading(false);
  }

  useEffect(() => {
    if (user && COSTS_ROLES.has(user.role)) load();
    const ch = supabase
      .channel("parts-costs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parts" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.role]);

  if (!user) return <LoadingPage />;

  if (!COSTS_ROLES.has(user.role)) {
    return (
      <AppShell user={user} nav={navForRole(user.role)}>
        <EmptyState title="Accès non autorisé" />
      </AppShell>
    );
  }

  const orderedGroups = groups.filter((g) => canGeneratePartsCostDocument(g.parts));
  const total = grandTotal(orderedGroups);

  return (
    <AppShell user={user} nav={navForRole(user.role)}>
      <PageHeader
        title="Coûts pièces par véhicule"
        subtitle="Récapitulatif après commande magasinier — générez un document avec le détail et le total"
      />

      {!loading && orderedGroups.length > 0 && (
        <div className="card-padded mb-6 border-emerald-200 bg-emerald-50/80">
          <p className="text-sm text-emerald-800">Total parc (pièces commandées et tarifées)</p>
          <p className="text-3xl font-bold text-emerald-950">{formatEuro(total)}</p>
          <p className="mt-1 text-sm text-emerald-800">
            {orderedGroups.length} véhicule(s) avec pièces commandées
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : orderedGroups.length === 0 ? (
        <EmptyState
          title="Aucun document disponible"
          description="Le magasinier doit d'abord commander les pièces (statut « Commandée » ou au-delà) et renseigner les prix."
        />
      ) : (
        <div className="space-y-3">
          {orderedGroups.map((g) => (
            <div key={g.vehicle.id} className="card-padded space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{g.vehicle.license_plate}</p>
                  <p className="text-sm text-slate-600">
                    {g.vehicle.make} {g.vehicle.model}
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatEuro(g.totalCost)}
                  </p>
                </div>
                <PartsCostDocumentButton vehicle={g.vehicle} parts={g.parts} />
              </div>
              <VehicleCostsCard group={g} defaultOpen />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
