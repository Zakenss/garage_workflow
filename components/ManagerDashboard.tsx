"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/VehicleCard";
import { StatusBadge } from "@/components/StatusBadge";
import { MechanicSlotButtons } from "@/components/MechanicSlotButtons";
import {
  MANAGER_NAV,
  WORKSHOP_ASSIGNED_STATUSES,
  WORKSHOP_WAITING_STATUS,
} from "@/lib/manager";
import { assignVehicleToMechanic } from "@/lib/manager-actions";
import { fetchManagerPipelineCounts } from "@/lib/manager-pipeline";
import { fetchPendingIssues } from "@/lib/mechanic-issues";
import { supabase } from "@/lib/supabase";
import {
  fetchAllWorkshopVehicles,
  fetchRepairCompleteVehicles,
  fetchWaitingVehicles,
} from "@/lib/workshop-vehicles";
import type { SessionUser, User, Vehicle } from "@/lib/types";

type VehicleWithMechanic = Vehicle & {
  mechanic: { full_name: string; mechanic_slot: number | null } | null;
};

export function ManagerDashboard({ user }: { user: SessionUser }) {
  const [waiting, setWaiting] = useState<Vehicle[]>([]);
  const [inWorkshop, setInWorkshop] = useState<VehicleWithMechanic[]>([]);
  const [completed, setCompleted] = useState<VehicleWithMechanic[]>([]);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [pendingSignalements, setPendingSignalements] = useState(0);
  const [pendingReception, setPendingReception] = useState(0);
  const [pendingVei, setPendingVei] = useState(0);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [workshopData, waitingList, completedList, pending, pipeline] = await Promise.all([
      fetchAllWorkshopVehicles(),
      fetchWaitingVehicles(),
      fetchRepairCompleteVehicles(),
      fetchPendingIssues(),
      fetchManagerPipelineCounts(),
    ]);
    setInWorkshop(workshopData);
    setWaiting(waitingList);
    setCompleted(completedList);
    setPendingSignalements(pending.length);
    setPendingReception(pipeline.pendingReception);
    setPendingVei(pipeline.pendingVei);

    const { data: mechanicsData } = await supabase
      .from("users")
      .select("id, full_name, username, role, mechanic_slot, active, created_at")
      .eq("role", "mechanic")
      .eq("active", true)
      .order("mechanic_slot");
    setMechanics((mechanicsData as User[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("manager-dash")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_reported_issues" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vei_cases" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_photos" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function quickAssign(vehicle: Vehicle, mechanicId: string, slot: number) {
    setBusySlot(slot);
    try {
      await assignVehicleToMechanic(vehicle.id, mechanicId, user, {
        priority: vehicle.dispatch_priority,
        licensePlate: vehicle.license_plate,
      });
      await load();
    } finally {
      setBusySlot(null);
    }
  }

  const activeCount = inWorkshop.filter((v) => v.status !== WORKSHOP_WAITING_STATUS).length;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble atelier" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Réception"
          value={pendingReception}
          href="/workshop/reception"
          highlight={pendingReception > 0}
        />
        <StatCard
          label="VEI"
          value={pendingVei}
          href="/workshop/vei"
          highlight={pendingVei > 0}
        />
        <StatCard
          label="À assigner"
          value={waiting.length}
          href="/workshop/in-workshop?tab=assign"
          highlight={waiting.length > 0}
        />
        <StatCard label="En atelier" value={activeCount} href="/workshop/in-workshop" />
        <StatCard
          label="Signalements"
          value={pendingSignalements}
          href="/workshop/issues"
          highlight={pendingSignalements > 0}
        />
        <StatCard label="Terminé" value={completed.length} href="/workshop/termine" />
      </div>

      {pendingSignalements > 0 && (
        <Link
          href="/workshop/issues"
          className="mb-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition-colors hover:bg-amber-100"
        >
          <span className="font-medium text-amber-900">
            {pendingSignalements} signalement{pendingSignalements > 1 ? "s" : ""} à valider
          </span>
          <span className="text-amber-700">Valider →</span>
        </Link>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {waiting.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">À assigner</h2>
                <Link
                  href="/workshop/in-workshop?tab=assign"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Tout voir →
                </Link>
              </div>
              <div className="space-y-3">
                {waiting.slice(0, 3).map((v) => (
                  <div key={v.id} className="card-padded space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{v.license_plate}</p>
                        <p className="text-sm text-slate-600">
                          {v.make} {v.model}
                        </p>
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                    <MechanicSlotButtons
                      mechanics={mechanics}
                      busySlot={busySlot}
                      onAssign={(mechanicId, slot) => quickAssign(v, mechanicId, slot)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">En atelier</h2>
              <Link
                href="/workshop/in-workshop"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Tout voir →
              </Link>
            </div>
            {activeCount === 0 ? (
              <EmptyState title="Aucun véhicule en cours" />
            ) : (
              <div className="space-y-2">
                {inWorkshop
                  .filter((v) => v.status !== WORKSHOP_WAITING_STATUS)
                  .slice(0, 6)
                  .map((v) => (
                    <Link
                      key={v.id}
                      href={`/workshop/vehicle/${v.id}`}
                      className="card-interactive flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{v.license_plate}</p>
                          {WORKSHOP_ASSIGNED_STATUSES.includes(v.status) && (
                            <PriorityBadge priority={v.dispatch_priority} />
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          {v.make} {v.model}
                          {v.mechanic && ` · Mécan. ${v.mechanic.mechanic_slot}`}
                        </p>
                      </div>
                      <StatusBadge status={v.status} />
                    </Link>
                  ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`stat-card block transition-colors hover:border-slate-300 ${
        highlight ? "border-amber-300 bg-amber-50" : "bg-white"
      }`}
    >
      <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-600">{label}</p>
    </Link>
  );
}
