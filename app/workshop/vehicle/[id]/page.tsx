"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { MechanicSlotButtons } from "@/components/MechanicSlotButtons";
import { PriorityBadge } from "@/components/VehicleCard";
import { StatusBadge } from "@/components/StatusBadge";
import { MechanicWorkPanel } from "@/components/MechanicWorkPanel";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import {
  assignVehicleToMechanic,
  REASSIGNABLE_STATUSES,
} from "@/lib/manager-actions";
import { fetchVehicleMechanicWork } from "@/lib/mechanic-work";
import { MANAGER_NAV } from "@/lib/manager";
import { STATUS_LABELS, TIMELINE_LABELS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import type { SessionUser, User, Vehicle, VehicleStatus } from "@/lib/types";

import type { MechanicPartRow } from "@/lib/mechanic-work";

type TimelineEntry = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  users?: { full_name: string } | null;
};

function timelineLabel(entry: TimelineEntry): string {
  if (entry.action === "status_change" && entry.details?.status) {
    const s = entry.details.status as VehicleStatus;
    return `Statut : ${STATUS_LABELS[s] ?? s}`;
  }
  return TIMELINE_LABELS[entry.action] ?? entry.action;
}

export default function WorkshopVehiclePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [parts, setParts] = useState<MechanicPartRow[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busySlot, setBusySlot] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).single();
    setVehicle(v as Vehicle);

    const { data: t } = await supabase
      .from("vehicle_timeline")
      .select("*, users(full_name)")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false });
    setTimeline((t as TimelineEntry[]) ?? []);

    const work = await fetchVehicleMechanicWork(id);
    setParts(work.parts);
    setPhotos(work.photoUrls);
  }

  useEffect(() => {
    load();
    supabase
      .from("users")
      .select("id, full_name, username, role, mechanic_slot, active, created_at")
      .eq("role", "mechanic")
      .eq("active", true)
      .order("mechanic_slot")
      .then(({ data }) => setMechanics((data as User[]) ?? []));

    const ch = supabase
      .channel(`workshop-vehicle-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles", filter: `id=eq.${id}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vehicle_timeline", filter: `vehicle_id=eq.${id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  async function reassign(mechanicId: string, slot: number) {
    if (!user || !vehicle || mechanicId === vehicle.assigned_mechanic_id) return;
    setBusySlot(slot);
    try {
      await assignVehicleToMechanic(vehicle.id, mechanicId, user, {
        isReassign: true,
        priority: vehicle.dispatch_priority,
        licensePlate: vehicle.license_plate,
      });
      await load();
    } finally {
      setBusySlot(null);
    }
  }

  if (!user || !vehicle) return <LoadingPage />;

  const canReassign = REASSIGNABLE_STATUSES.includes(
    vehicle.status as (typeof REASSIGNABLE_STATUSES)[number]
  );

  return (
    <AppShell
      user={user}
      nav={[
        ...MANAGER_NAV,
        { href: "/workshop/in-workshop", label: "Atelier" },
        { href: `/workshop/vehicle/${id}`, label: vehicle.license_plate },
      ]}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{vehicle.license_plate}</h1>
            <PriorityBadge priority={vehicle.dispatch_priority} />
          </div>
          <p className="page-subtitle">
            {vehicle.make} {vehicle.model}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      <section className="card-padded mb-6">
        <h2 className="section-title mb-4">Avancement atelier</h2>
        <WorkflowProgress status={vehicle.status} />
      </section>

      {vehicle.status === "in_workshop" && (
        <Alert variant="success" className="mb-6">
          En attente d&apos;assignation —{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => router.push(`/workshop/in-workshop?new=${id}&tab=assign`)}
          >
            assigner à un mécanicien
          </button>
        </Alert>
      )}

      {canReassign && (
        <section className="card-padded mb-6">
          <h2 className="section-title mb-3">Réassigner le mécanicien</h2>
          <MechanicSlotButtons
            mechanics={mechanics}
            assignedMechanicId={vehicle.assigned_mechanic_id}
            busySlot={busySlot}
            label="Mécanicien"
            onAssign={reassign}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-padded">
          <h2 className="section-title">Informations</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">VIN</dt>
              <dd className="font-medium">{vehicle.vin ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Arrivée</dt>
              <dd className="font-medium">{vehicle.arrival_date}</dd>
            </div>
            {vehicle.workshop_notes && (
              <div>
                <dt className="text-slate-500">Notes réception</dt>
                <dd className="mt-1">{vehicle.workshop_notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card-padded">
          <h2 className="section-title">Historique</h2>
          <ul className="mt-4 max-h-80 space-y-3 overflow-auto text-sm scrollbar-thin">
            {timeline.map((e) => (
              <li key={e.id} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="font-medium">{timelineLabel(e)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(e.created_at).toLocaleString("fr-FR")}
                  {e.users?.full_name && ` · ${e.users.full_name}`}
                </p>
              </li>
            ))}
            {timeline.length === 0 && (
              <p className="text-slate-500">Aucun événement enregistré.</p>
            )}
          </ul>
        </section>
      </div>

      {(parts.length > 0 || photos.length > 0) && (
        <section className="mt-8">
          <h2 className="section-title mb-4">Pièces & photos (mécanicien)</h2>
          <MechanicWorkPanel parts={parts} photoUrls={photos} />
        </section>
      )}
    </AppShell>
  );
}
