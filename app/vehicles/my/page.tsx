"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VehicleCard } from "@/components/VehicleCard";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function MyVehiclesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[{ href: "/vehicles/my", label: "Mes véhicules" }]}
    >
      <h1 className="mb-6 text-2xl font-bold">Mes véhicules</h1>
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
        {vehicles.length === 0 && (
          <p className="text-slate-500">Aucun véhicule assigné.</p>
        )}
      </div>
    </AppShell>
  );
}
