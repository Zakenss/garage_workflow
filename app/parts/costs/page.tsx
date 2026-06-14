"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { VehicleCostsCard } from "@/components/PartPricingEditor";
import { ADMIN_NAV, navForRole } from "@/lib/role-nav";
import { useSession } from "@/lib/session-context";
import {
  fetchAllVehiclePartCosts,
  formatEuro,
  grandTotal,
  type VehiclePartsCost,
} from "@/lib/parts-costs";
import { supabase } from "@/lib/supabase";

export default function PartsCostsPage() {
  const user = useSession();
  const [groups, setGroups] = useState<VehiclePartsCost[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setGroups(await fetchAllVehiclePartCosts());
    setLoading(false);
  }

  useEffect(() => {
    if (user?.role === "admin") load();
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

  if (user.role !== "admin") {
    return (
      <AppShell user={user} nav={navForRole(user.role)}>
        <EmptyState title="Accès réservé à l'administration" />
      </AppShell>
    );
  }

  const total = grandTotal(groups);

  return (
    <AppShell user={user} nav={[...ADMIN_NAV]}>
      <PageHeader
        title="Coûts pièces par véhicule"
        subtitle="Fournisseur et prix saisis par le magasinier — totaux calculés automatiquement"
      />

      {!loading && groups.length > 0 && (
        <div className="card-padded mb-6 border-emerald-200 bg-emerald-50/80">
          <p className="text-sm text-emerald-800">Total parc (pièces tarifées)</p>
          <p className="text-3xl font-bold text-emerald-950">{formatEuro(total)}</p>
          <p className="mt-1 text-sm text-emerald-800">{groups.length} véhicule(s)</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Aucun coût enregistré"
          description="Le magasinier doit renseigner fournisseur et prix pour chaque pièce."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <VehicleCostsCard key={g.vehicle.id} group={g} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
