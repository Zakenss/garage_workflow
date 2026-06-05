"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VehicleCard } from "@/components/VehicleCard";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function ReceptionListPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .eq("status", "arrived")
      .order("arrival_date", { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/workshop/reception", label: "Réception" },
        { href: "/workshop/vei", label: "VEI" },
        { href: "/workshop/assign", label: "Dispatch" },
      ]}
    >
      <h1 className="mb-6 text-2xl font-bold">Réception atelier</h1>
      <p className="mb-4 text-sm text-slate-600">Véhicules arrivés en attente de réception</p>
      <div className="space-y-3">
        {vehicles.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            href={`/workshop/reception/${v.id}`}
            subtitle={v.client_name ?? undefined}
          />
        ))}
        {vehicles.length === 0 && (
          <p className="text-slate-500">Aucun véhicule en attente.</p>
        )}
      </div>
    </AppShell>
  );
}
