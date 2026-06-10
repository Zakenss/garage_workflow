"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/VehicleCard";
import { StatusBadge } from "@/components/StatusBadge";
import { MechanicSlotButtons } from "@/components/MechanicSlotButtons";
import { VeiStatusPicker } from "@/components/VeiStatusPicker";
import {
  MANAGER_NAV,
  WORKSHOP_ASSIGNED_STATUSES,
  WORKSHOP_WAITING_STATUS,
} from "@/lib/manager";
import { assignVehicleToMechanic, updateVeiStatus, type VeiStatus } from "@/lib/manager-actions";
import { VEI_STATUS_LABELS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import {
  fetchAllWorkshopVehicles,
  fetchWaitingVehicles,
} from "@/lib/workshop-vehicles";
import type { SessionUser, User, Vehicle } from "@/lib/types";

type VeiAlert = {
  id: string;
  status: string;
  vehicles: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
  };
};

type VehicleWithMechanic = Vehicle & {
  mechanic: { full_name: string; mechanic_slot: number | null } | null;
};

export function ManagerDashboard({ user }: { user: SessionUser }) {
  const [arrived, setArrived] = useState<Vehicle[]>([]);
  const [inWorkshop, setInWorkshop] = useState<VehicleWithMechanic[]>([]);
  const [waiting, setWaiting] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [veiAlerts, setVeiAlerts] = useState<VeiAlert[]>([]);
  const [veiToSchedule, setVeiToSchedule] = useState(0);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [busyVeiId, setBusyVeiId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: arrivedData } = await supabase
      .from("vehicles")
      .select("*")
      .eq("status", "arrived")
      .order("arrival_date", { ascending: false });
    setArrived((arrivedData as Vehicle[]) ?? []);

    const workshopData = await fetchAllWorkshopVehicles();
    setInWorkshop(workshopData);
    setWaiting(await fetchWaitingVehicles());

    const { data: mechanicsData } = await supabase
      .from("users")
      .select("id, full_name, username, role, mechanic_slot, active, created_at")
      .eq("role", "mechanic")
      .eq("active", true)
      .order("mechanic_slot");
    setMechanics((mechanicsData as User[]) ?? []);

    const { data: veiData } = await supabase
      .from("vei_cases")
      .select("id, status, vehicles(id, license_plate, make, model)")
      .neq("status", "completed")
      .order("created_at", { ascending: false });
    setVeiAlerts((veiData as unknown as VeiAlert[]) ?? []);

    const { count: toSchedule } = await supabase
      .from("vei_cases")
      .select("*", { count: "exact", head: true })
      .eq("status", "to_schedule");
    setVeiToSchedule(toSchedule ?? 0);
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
        { event: "*", schema: "public", table: "vei_cases" },
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

  async function quickVeiStatus(alert: VeiAlert, status: VeiStatus) {
    if (alert.status === status || !alert.vehicles) return;
    setBusyVeiId(alert.id);
    try {
      await updateVeiStatus(alert.id, status, user, alert.vehicles.id);
      await load();
    } finally {
      setBusyVeiId(null);
    }
  }

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Tableau de bord"
        subtitle="Réception et suivi atelier"
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="À assigner"
          value={waiting.length}
          href="/workshop/in-workshop?tab=assign"
          highlight={waiting.length > 0}
        />
        <StatCard
          label="En atelier"
          value={inWorkshop.length}
          href="/workshop/in-workshop"
        />
        <StatCard label="Arrivés" value={arrived.length} href="/workshop/reception" />
        <StatCard
          label="VEI à planifier"
          value={veiToSchedule}
          href="/workshop/vei"
          highlight={veiToSchedule > 0}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title">Véhicules arrivés</h2>
              <Link href="/workshop/reception" className="text-sm text-slate-600 hover:text-slate-900">
                Voir tout →
              </Link>
            </div>
            {arrived.length === 0 ? (
              <EmptyState title="Aucun véhicule arrivé" />
            ) : (
              <div className="space-y-2">
                {arrived.map((v) => (
                  <Link
                    key={v.id}
                    href={`/workshop/reception/${v.id}`}
                    className="card-interactive flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{v.license_plate}</p>
                      <p className="text-sm text-slate-600">
                        {v.make} {v.model}
                      </p>
                    </div>
                    <StatusBadge status={v.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title">
                À assigner ({waiting.length})
              </h2>
              <Link
                href="/workshop/in-workshop"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Atelier →
              </Link>
            </div>
            {waiting.length === 0 ? (
              <EmptyState title="Aucun véhicule en attente d'assignation" />
            ) : (
              <div className="space-y-3">
                {waiting.slice(0, 5).map((v) => (
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
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title">En cours en atelier</h2>
              <Link
                href="/workshop/in-workshop"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Voir tout →
              </Link>
            </div>
            {inWorkshop.filter((v) => v.status !== WORKSHOP_WAITING_STATUS).length ===
            0 ? (
              <EmptyState title="Aucun véhicule en cours" />
            ) : (
              <div className="space-y-2">
                {inWorkshop
                  .filter((v) => v.status !== WORKSHOP_WAITING_STATUS)
                  .slice(0, 5)
                  .map((v) => (
                  <Link
                    key={v.id}
                    href={`/workshop/vehicle/${v.id}`}
                    className="card-interactive flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{v.license_plate}</p>
                        {WORKSHOP_ASSIGNED_STATUSES.includes(v.status) && (
                          <PriorityBadge priority={v.dispatch_priority} />
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {v.make} {v.model}
                      </p>
                      {WORKSHOP_ASSIGNED_STATUSES.includes(v.status) && v.mechanic && (
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          Mécanicien {v.mechanic.mechanic_slot ?? "?"} —{" "}
                          {v.mechanic.full_name}
                        </p>
                      )}
                      {v.status === WORKSHOP_WAITING_STATUS && (
                        <p className="mt-1 text-xs text-amber-700">
                          En attente d&apos;assignation
                        </p>
                      )}
                    </div>
                    <StatusBadge status={v.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title">Alertes VEI</h2>
              <Link href="/workshop/vei" className="text-sm text-slate-600 hover:text-slate-900">
                Liste VEI →
              </Link>
            </div>
            {veiAlerts.length === 0 ? (
              <EmptyState title="Aucune alerte VEI" />
            ) : (
              <div className="space-y-3">
                {veiAlerts.map((r) => {
                  const vehicle = r.vehicles;
                  if (!vehicle) return null;
                  return (
                  <div key={r.id} className="card-padded space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{vehicle.license_plate}</p>
                        <p className="text-sm text-slate-600">
                          {vehicle.make} {vehicle.model}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                        {VEI_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </div>
                    <VeiStatusPicker
                      status={r.status}
                      compact
                      disabled={busyVeiId === r.id}
                      onChange={(status) => quickVeiStatus(r, status)}
                    />
                  </div>
                  );
                })}
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
