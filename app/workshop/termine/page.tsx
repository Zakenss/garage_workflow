"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MANAGER_NAV } from "@/lib/manager";
import { supabase } from "@/lib/supabase";
import {
  fetchRepairCompleteVehicles,
  type VehicleWithMechanic,
} from "@/lib/workshop-vehicles";

export default function TerminePage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<VehicleWithMechanic[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setVehicles(await fetchRepairCompleteVehicles());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("workshop-termine")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Terminé"
        subtitle="Véhicules réparés par les mécaniciens — en attente de la suite du workflow"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule terminé"
          description="Les véhicules apparaîtront ici une fois le reconditionnement mécanicien validé."
        />
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              href={`/workshop/vehicle/${v.id}`}
              className="card-interactive flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{v.license_plate}</p>
                <p className="text-sm text-slate-600">
                  {v.make} {v.model}
                </p>
                {v.mechanic && (
                  <p className="mt-1 text-xs text-slate-500">
                    Mécanicien {v.mechanic.mechanic_slot} — {v.mechanic.full_name}
                  </p>
                )}
              </div>
              <StatusBadge status={v.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
