"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import { navForRole } from "@/lib/role-nav";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function SecretaryTrackingPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .order("updated_at", { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("secretary-tracking")
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

  const filtered = vehicles.filter(
    (v) =>
      !search ||
      v.license_plate.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      (v.client_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <AppShell user={user} nav={navForRole(user.role)}>
      <PageHeader
        title="Suivi des véhicules"
        subtitle="Avancement de l'arrivée jusqu'à la vente"
      />

      <input
        placeholder="Rechercher immatriculation, client, marque…"
        className="input-field mb-6"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Rechercher un véhicule"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun véhicule trouvé"
          description="Les véhicules enregistrés apparaîtront ici avec leur avancement."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((v) => (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className="card-interactive block space-y-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{v.license_plate}</p>
                  <p className="text-sm text-slate-600">
                    {v.make} {v.model}
                    {v.client_name && ` · ${v.client_name}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Arrivée : {v.arrival_date}
                  </p>
                </div>
                <StatusBadge status={v.status} />
              </div>
              <WorkflowProgress status={v.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
