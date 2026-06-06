"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { VehicleCard } from "@/components/VehicleCard";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function MyVehiclesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .eq("assigned_mechanic_id", user.id)
      .in("status", [
        "diagnostic_assigned",
        "repair_in_progress",
        "validation_pending",
      ])
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
      nav={[{ href: "/vehicles/my", label: "Mes véhicules" }]}
    >
      <PageHeader
        title="Mes véhicules"
        subtitle="Diagnostics et réparations assignés"
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
              href={
                v.status === "diagnostic_assigned"
                  ? `/vehicles/diagnostic/${v.id}`
                  : `/vehicles/repair/${v.id}`
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
