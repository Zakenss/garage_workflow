"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { AssignmentHistoryList } from "@/components/AssignmentHistoryList";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { MechanicProgressBoard } from "@/components/MechanicProgressBoard";
import { MechanicSlotButtons } from "@/components/MechanicSlotButtons";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/VehicleCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  assignVehicleToMechanic,
  REASSIGNABLE_STATUSES,
  saveVehiclePriority,
} from "@/lib/manager-actions";
import { MANAGER_NAV } from "@/lib/manager";
import { supabase } from "@/lib/supabase";
import {
  fetchAssignedVehicles,
  fetchAssignmentHistory,
  fetchWaitingVehicles,
  type AssignmentHistoryRow,
  type VehicleWithMechanic,
} from "@/lib/workshop-vehicles";
import type { SessionUser, User, Vehicle } from "@/lib/types";

type Tab = "assign" | "active" | "mechanics" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "assign", label: "À assigner" },
  { id: "active", label: "En cours" },
  { id: "mechanics", label: "Par mécanicien" },
  { id: "history", label: "Historique" },
];

export default function InWorkshopPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <InWorkshopContent />
    </Suspense>
  );
}

function InWorkshopContent() {
  const searchParams = useSearchParams();
  const newVehicleId = searchParams.get("new");
  const initialTab = (searchParams.get("tab") as Tab) || "assign";

  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [waiting, setWaiting] = useState<Vehicle[]>([]);
  const [assigned, setAssigned] = useState<VehicleWithMechanic[]>([]);
  const [history, setHistory] = useState<AssignmentHistoryRow[]>([]);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [justSentPlate, setJustSentPlate] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const [waitingList, assignedList, historyList, mechanicsRes] = await Promise.all([
      fetchWaitingVehicles(),
      fetchAssignedVehicles(),
      fetchAssignmentHistory(),
      supabase
        .from("users")
        .select("id, full_name, username, role, mechanic_slot, active, created_at")
        .eq("role", "mechanic")
        .eq("active", true)
        .order("mechanic_slot"),
    ]);

    setWaiting(waitingList);
    setAssigned(assignedList);
    setHistory(historyList);
    setMechanics((mechanicsRes.data as User[]) ?? []);

    if (newVehicleId) {
      const sent = waitingList.find((v) => v.id === newVehicleId);
      if (sent) {
        setJustSentPlate(sent.license_plate);
        setTab("assign");
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("in-workshop")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () =>
        load()
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
  }, [newVehicleId]);

  useEffect(() => {
    if (justSentPlate && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [justSentPlate, loading]);

  async function handleAssign(
    vehicle: Vehicle,
    mechanicId: string,
    slot: number,
    isReassign: boolean
  ) {
    if (!user) return;
    setBusySlot(slot);
    try {
      await assignVehicleToMechanic(vehicle.id, mechanicId, user, {
        priority: vehicle.dispatch_priority,
        isReassign,
        licensePlate: vehicle.license_plate,
      });
      setJustSentPlate(null);
      await load();
    } finally {
      setBusySlot(null);
    }
  }

  async function setPriority(vehicleId: string, priority: number | null) {
    await saveVehiclePriority(vehicleId, priority);
    await load();
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Atelier"
        subtitle={`${waiting.length + assigned.length} véhicule(s) — assigner, suivre et réassigner`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "btn-chip-active" : "btn-chip-inactive"}
          >
            {t.label}
            {t.id === "assign" && waiting.length > 0 && ` (${waiting.length})`}
            {t.id === "active" && assigned.length > 0 && ` (${assigned.length})`}
          </button>
        ))}
      </div>

      {justSentPlate && tab === "assign" && (
        <Alert variant="success" className="mb-6">
          <strong>{justSentPlate}</strong> envoyé en atelier — choisissez Mécan. 1, 2 ou 3
          ci-dessous pour assigner le diagnostic.
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {tab === "assign" && (
            <section>
              {waiting.length === 0 ? (
                <EmptyState
                  title="Aucun véhicule en attente d'assignation"
                  description="Les véhicules apparaissent ici après « Envoyer à l'atelier » depuis la réception."
                />
              ) : (
                <div className="space-y-3">
                  {waiting.map((v) => {
                    const isNew = v.id === newVehicleId;
                    return (
                      <div
                        key={v.id}
                        ref={isNew ? highlightRef : undefined}
                        className={`card-padded space-y-4 ${isNew ? "ring-2 ring-emerald-500 ring-offset-2" : ""}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">{v.license_plate}</p>
                              <PriorityBadge priority={v.dispatch_priority} />
                              {isNew && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                  Nouveau
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">
                              {v.make} {v.model}
                            </p>
                          </div>
                          <StatusBadge status={v.status} />
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            Priorité (optionnel)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setPriority(v.id, n)}
                                className={
                                  v.dispatch_priority === n
                                    ? "btn-chip-active min-w-10"
                                    : "btn-chip-inactive min-w-10"
                                }
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>

                        <MechanicSlotButtons
                          mechanics={mechanics}
                          busySlot={busySlot}
                          onAssign={(mechanicId, slot) =>
                            handleAssign(v, mechanicId, slot, false)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === "active" && (
            <section>
              {assigned.length === 0 ? (
                <EmptyState title="Aucun véhicule en cours chez les mécaniciens" />
              ) : (
                <div className="space-y-3">
                  {assigned.map((v) => {
                    const canReassign = REASSIGNABLE_STATUSES.includes(
                      v.status as (typeof REASSIGNABLE_STATUSES)[number]
                    );
                    return (
                      <div key={v.id} className="card-padded space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/workshop/vehicle/${v.id}`}
                                className="text-lg font-semibold text-slate-900 hover:underline"
                              >
                                {v.license_plate}
                              </Link>
                              <PriorityBadge priority={v.dispatch_priority} />
                            </div>
                            <p className="text-sm text-slate-600">
                              {v.make} {v.model}
                            </p>
                          </div>
                          <StatusBadge status={v.status} />
                        </div>

                        {canReassign ? (
                          <MechanicSlotButtons
                            mechanics={mechanics}
                            assignedMechanicId={v.assigned_mechanic_id}
                            busySlot={busySlot}
                            label="Réassigner à"
                            onAssign={(mechanicId, slot) => {
                              if (mechanicId === v.assigned_mechanic_id) return;
                              handleAssign(v, mechanicId, slot, true);
                            }}
                          />
                        ) : (
                          v.mechanic && (
                            <p className="text-sm text-slate-600">
                              Mécanicien {v.mechanic.mechanic_slot} — {v.mechanic.full_name}
                            </p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === "mechanics" && (
            <section>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Vue par mécanicien — cliquez sur un véhicule pour voir le détail.
                </p>
                <Link href="/workshop/queue" className="btn-secondary text-sm">
                  Réordonner les priorités
                </Link>
              </div>
              <MechanicProgressBoard mechanics={mechanics} assigned={assigned} />
            </section>
          )}

          {tab === "history" && (
            <section>
              {history.length === 0 ? (
                <EmptyState title="Aucune assignation enregistrée" />
              ) : (
                <AssignmentHistoryList rows={history} />
              )}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
