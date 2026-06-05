"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { NotificationsBell } from "@/components/NotificationsBell";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle, VehicleStatus } from "@/lib/types";

const DASHBOARD_STATUSES: VehicleStatus[] = [
  "arrived",
  "diagnostic_assigned",
  "diagnostic_complete",
  "parts_pending",
  "repair_in_progress",
  "bodywork_in_progress",
  "ready_to_sell",
  "for_sale",
];

export default function DashboardPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [veiCount, setVeiCount] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase.from("vehicles").select("*").order("updated_at", {
      ascending: false,
    });
    setVehicles((data as Vehicle[]) ?? []);
    const { count } = await supabase
      .from("vei_cases")
      .select("*", { count: "exact", head: true })
      .neq("status", "completed");
    setVeiCount(count ?? 0);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("vehicles-dash")
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

  if (!user) return <p className="p-6">Chargement…</p>;

  const filtered = vehicles.filter(
    (v) =>
      !search ||
      v.license_plate.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase())
  );

  const counts = DASHBOARD_STATUSES.reduce(
    (acc, s) => {
      acc[s] = vehicles.filter((v) => v.status === s).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/workshop/vei", label: "Liste VEI" },
        { href: "/workshop/assign", label: "Dispatch" },
        { href: "/workshop/reception", label: "Réception" },
        { href: "/workshop/validation", label: "Validation" },
        { href: "/workshop/final", label: "Final" },
        { href: "/users", label: "Utilisateurs" },
      ]}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Vue globale</h1>
        <NotificationsBell user={user} />
      </div>

      <input
        placeholder="Rechercher immatriculation, marque…"
        className="mb-6 w-full rounded-lg border px-3 py-2"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Arrivés" value={counts.arrived ?? 0} />
        <StatCard label="En diagnostic" value={counts.diagnostic_assigned ?? 0} />
        <StatCard label="VEI actifs" value={veiCount} highlight />
        <StatCard label="Attente pièces" value={counts.parts_pending ?? 0} />
        <StatCard label="Réparation" value={counts.repair_in_progress ?? 0} />
        <StatCard label="Carrosserie" value={counts.bodywork_in_progress ?? 0} />
        <StatCard label="Prêts à vendre" value={counts.ready_to_sell ?? 0} />
        <StatCard label="En vente" value={counts.for_sale ?? 0} />
      </div>

      <div className="space-y-2">
        {filtered.map((v) => (
          <a
            key={v.id}
            href={`/vehicles/${v.id}`}
            className="flex items-center justify-between rounded-xl border bg-white p-4 hover:bg-slate-50"
          >
            <div>
              <p className="font-semibold">{v.license_plate}</p>
              <p className="text-sm text-slate-600">
                {v.make} {v.model}
              </p>
            </div>
            <StatusBadge status={v.status} />
          </a>
        ))}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${highlight ? "border-amber-300 bg-amber-50" : "bg-white"}`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}
