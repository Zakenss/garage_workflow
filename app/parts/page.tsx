"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { VehicleMechanicWorkCard } from "@/components/MechanicWorkPanel";
import { MANAGER_NAV } from "@/lib/manager";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import { fetchAllMechanicWork, type VehicleMechanicWork } from "@/lib/mechanic-work";
import { supabase } from "@/lib/supabase";
import { notifyUser } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export default function PartsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<VehicleMechanicWork[]>([]);
  const [loading, setLoading] = useState(true);

  const isStorekeeper = user?.role === "storekeeper";
  const isManager = user?.role === "workshop_manager";

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    setRows(await fetchAllMechanicWork());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("parts-work")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parts" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diagnostic_photos" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function setPartStatus(
    row: VehicleMechanicWork,
    partId: string,
    status: string
  ) {
    await supabase.from("parts").update({ status }).eq("id", partId);
    const part = row.parts.find((p) => p.id === partId);
    if (status === "received" && part) {
      const { data: v } = await supabase
        .from("vehicles")
        .select("assigned_mechanic_id, license_plate")
        .eq("id", row.vehicle.id)
        .single();
      if (v?.assigned_mechanic_id) {
        await notifyUser(
          v.assigned_mechanic_id,
          "parts_received",
          `Pièces reçues — ${v.license_plate}`,
          row.vehicle.id
        );
      }
    }
    await load();
  }

  if (!user) return <LoadingPage />;

  const nav = isManager
    ? [...MANAGER_NAV]
    : [...STOREKEEPER_NAV];

  return (
    <AppShell user={user} nav={nav}>
      <PageHeader
        title="Pièces & photos mécanicien"
        subtitle={
          isStorekeeper
            ? "Liste des pièces et photos déposées — gérer le statut des commandes"
            : "Liste des pièces et photos déposées par les mécaniciens"
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune pièce ni photo"
          description="Les diagnostics terminés par les mécaniciens apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.vehicle.id} className="space-y-2">
              {isStorekeeper && (
                <Link
                  href={`/parts/checklist/${row.vehicle.id}`}
                  className="inline-flex text-sm font-medium text-slate-700 hover:underline"
                >
                  Ouvrir check-list magasinier →
                </Link>
              )}
              <VehicleMechanicWorkCard
              key={row.vehicle.id}
              licensePlate={row.vehicle.license_plate}
              make={row.vehicle.make}
              model={row.vehicle.model}
              status={row.vehicle.status}
              parts={row.parts}
              photoUrls={row.photoUrls}
              canEditStatus={isStorekeeper}
              onStatusChange={(partId, status) => setPartStatus(row, partId, status)}
            />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
