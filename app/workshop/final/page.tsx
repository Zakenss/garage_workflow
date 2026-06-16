"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { MANAGER_NAV } from "@/lib/manager";
import { fetchRepairCompleteVehicles } from "@/lib/workshop-vehicles";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function FinalListPage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setVehicles(await fetchRepairCompleteVehicles());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("workshop-final")
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
        title="Validation finale"
        subtitle="Contrôle final avant mise en vente"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule en validation finale"
          description="Les réparations terminées apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              href={`/workshop/final/${v.id}`}
              className="card-interactive"
            >
              <p className="font-semibold">{v.license_plate}</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {v.make} {v.model}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
