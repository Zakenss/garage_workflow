"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { VehicleCard } from "@/components/VehicleCard";
import { MECHANIC_NAV } from "@/lib/role-nav";
import { useSession } from "@/lib/session-context";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function MyVehiclesPage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .eq("assigned_mechanic_id", user.id)
      .in("status", [
        "diagnostic_assigned",
        "parts_pending",
        "validation_pending",
        "repair_in_progress",
      ])
      .order("dispatch_priority", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[...MECHANIC_NAV]}
    >
      <PageHeader
        title="Mes véhicules"
        subtitle="Check-list de reconditionnement — ordre défini par le chef d'atelier"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule assigné"
          description="Le chef d'atelier vous assignera des véhicules via le dispatch."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              showPriority
              href={`/vehicles/checklist/${v.id}`}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
