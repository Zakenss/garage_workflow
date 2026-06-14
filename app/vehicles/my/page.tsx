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
import type { Vehicle, VehicleStatus } from "@/lib/types";

const ACTIVE_STATUSES: VehicleStatus[] = [
  "diagnostic_assigned",
  "parts_pending",
  "validation_pending",
  "repair_in_progress",
];

function vehicleHref(v: Vehicle): string {
  if (v.status === "validation_pending" || v.status === "repair_in_progress") {
    return `/vehicles/followup/${v.id}`;
  }
  return `/vehicles/checklist/${v.id}`;
}

function vehicleSubtitle(v: Vehicle): string {
  switch (v.status) {
    case "parts_pending":
      return "Check-list soumise — en attente pièces magasin";
    case "validation_pending":
      return "Pièces reçues — réception, réparations & signalements";
    case "repair_in_progress":
      return "Réparations en cours";
    default:
      return "Check-list de reconditionnement";
  }
}

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
      .in("status", ACTIVE_STATUSES)
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
    <AppShell user={user} nav={[...MECHANIC_NAV]}>
      <PageHeader
        title="Mes véhicules"
        subtitle="Check-list initiale, puis réception pièces et réparations via Signalements"
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
              href={vehicleHref(v)}
              subtitle={vehicleSubtitle(v)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
