"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  MANAGER_NAV,
  WORKSHOP_ASSIGNED_STATUSES,
  WORKSHOP_WAITING_STATUS,
} from "@/lib/manager";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle, VehicleStatus } from "@/lib/types";

type VehicleWithMechanic = Vehicle & {
  mechanic: { full_name: string; mechanic_slot: number | null } | null;
};

type AssignmentRow = {
  id: string;
  created_at: string;
  status: string;
  vehicles: {
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
  };
  mechanic: { full_name: string; mechanic_slot: number | null };
  assigned_by_user: { full_name: string } | null;
};

export default function InWorkshopPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [waiting, setWaiting] = useState<VehicleWithMechanic[]>([]);
  const [assigned, setAssigned] = useState<VehicleWithMechanic[]>([]);
  const [history, setHistory] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const vehicleSelect =
      "*, mechanic:users!assigned_mechanic_id(full_name, mechanic_slot)";

    const { data: waitingData } = await supabase
      .from("vehicles")
      .select(vehicleSelect)
      .eq("status", WORKSHOP_WAITING_STATUS)
      .order("updated_at", { ascending: false });

    const { data: assignedData } = await supabase
      .from("vehicles")
      .select(vehicleSelect)
      .in("status", WORKSHOP_ASSIGNED_STATUSES)
      .order("updated_at", { ascending: false });

    const { data: historyData } = await supabase
      .from("mechanic_assignments")
      .select(
        "id, created_at, status, vehicles(license_plate, make, model, status), mechanic:users!mechanic_id(full_name, mechanic_slot), assigned_by_user:users!assigned_by(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    setWaiting((waitingData as VehicleWithMechanic[]) ?? []);
    setAssigned((assignedData as VehicleWithMechanic[]) ?? []);
    setHistory((historyData as unknown as AssignmentRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("in-workshop")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_assignments" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (!user) return <LoadingPage />;

  const totalActive = waiting.length + assigned.length;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Véhicules en atelier"
        subtitle={`${totalActive} véhicule(s) en cours — jusqu'à réparation terminée`}
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title">
                En attente d&apos;assignation ({waiting.length})
              </h2>
              <Link href="/workshop/assign" className="text-sm text-slate-600 hover:text-slate-900">
                Dispatch →
              </Link>
            </div>
            {waiting.length === 0 ? (
              <EmptyState title="Aucun véhicule en attente" />
            ) : (
              <div className="space-y-2">
                {waiting.map((v) => (
                  <VehicleRow key={v.id} vehicle={v} href="/workshop/assign" />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="section-title mb-3">
              Assignés aux mécaniciens ({assigned.length})
            </h2>
            {assigned.length === 0 ? (
              <EmptyState title="Aucun véhicule assigné en cours" />
            ) : (
              <div className="space-y-2">
                {assigned.map((v) => (
                  <VehicleRow key={v.id} vehicle={v} showMechanic />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="section-title mb-3">Historique des assignations</h2>
            {history.length === 0 ? (
              <EmptyState title="Aucune assignation enregistrée" />
            ) : (
              <div className="space-y-2">
                {history.map((row) => (
                  <div key={row.id} className="card-padded">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{row.vehicles.license_plate}</p>
                        <p className="text-sm text-slate-600">
                          {row.vehicles.make} {row.vehicles.model}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(row.created_at).toLocaleString("fr-FR")}
                          {row.assigned_by_user &&
                            ` · Assigné par ${row.assigned_by_user.full_name}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                          Mécanicien {row.mechanic.mechanic_slot ?? "?"} —{" "}
                          {row.mechanic.full_name}
                        </span>
                        <StatusBadge status={row.vehicles.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function VehicleRow({
  vehicle,
  href,
  showMechanic,
}: {
  vehicle: VehicleWithMechanic;
  href?: string;
  showMechanic?: boolean;
}) {
  const content = (
    <>
      <div>
        <p className="font-semibold">{vehicle.license_plate}</p>
        <p className="text-sm text-slate-600">
          {vehicle.make} {vehicle.model}
        </p>
        {showMechanic && vehicle.mechanic && (
          <p className="mt-1 text-xs font-medium text-slate-700">
            Mécanicien {vehicle.mechanic.mechanic_slot ?? "?"} —{" "}
            {vehicle.mechanic.full_name}
          </p>
        )}
        {showMechanic && !vehicle.mechanic && (
          <p className="mt-1 text-xs text-slate-500">Mécanicien non renseigné</p>
        )}
      </div>
      <StatusBadge status={vehicle.status} />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card-interactive flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="card-padded flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {content}
    </div>
  );
}
