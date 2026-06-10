"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle, VehicleStatus } from "@/lib/types";

const STOREKEEPER_VEHICLE_STATUSES: VehicleStatus[] = [
  "diagnostic_complete",
  "parts_pending",
  "validation_pending",
  "repair_in_progress",
  "repair_complete",
];

export default function StorekeeperChecklistListPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .in("status", STOREKEEPER_VEHICLE_STATUSES)
      .order("updated_at", { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("storekeeper-checklist-list")
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
    <AppShell user={user} nav={[...STOREKEEPER_NAV]}>
      <PageHeader
        title="Check-list magasinier"
        subtitle="Analyse du rapport mécanicien — sélectionnez un véhicule"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun dossier à analyser"
          description="Les véhicules avec diagnostic terminé apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              href={`/parts/checklist/${v.id}`}
              className="card-padded flex flex-col gap-2 transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{v.license_plate}</p>
                <p className="text-sm text-slate-600">
                  {v.make} {v.model}
                </p>
              </div>
              <StatusBadge status={v.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
