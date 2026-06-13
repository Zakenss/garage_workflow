"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import { STATUS_LABELS, TIMELINE_LABELS } from "@/lib/constants";
import { navForRole } from "@/lib/role-nav";
import { getPublicUrl, supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle, VehicleStatus } from "@/lib/types";

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

function navForVehicle(user: SessionUser, vehicle: Vehicle) {
  return navForRole(user.role, [
    { href: `/vehicles/${vehicle.id}`, label: vehicle.license_plate },
  ]);
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [mechanicName, setMechanicName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  useEffect(() => {
    async function load() {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).single();
      setVehicle(v as Vehicle);

      if (v?.assigned_mechanic_id) {
        const { data: mech } = await supabase
          .from("users")
          .select("full_name, mechanic_slot")
          .eq("id", v.assigned_mechanic_id)
          .single();
        if (mech) {
          setMechanicName(
            `Mécanicien ${mech.mechanic_slot ?? "?"} — ${mech.full_name}`
          );
        }
      }

      const { data: t } = await supabase
        .from("vehicle_timeline")
        .select("*, users(full_name)")
        .eq("vehicle_id", id)
        .order("created_at", { ascending: false });
      setTimeline((t as TimelineEntry[]) ?? []);

      const { data: p } = await supabase
        .from("vehicle_photos")
        .select("storage_path")
        .eq("vehicle_id", id);
      setPhotos(
        (p ?? []).map((x) => getPublicUrl("vehicle-photos", x.storage_path))
      );
    }
    load();

    const ch = supabase
      .channel(`vehicle-detail-${id}`)
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

  if (!user || !vehicle) return <LoadingPage />;

  return (
    <AppShell user={user} nav={navForVehicle(user, vehicle)}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">{vehicle.license_plate}</h1>
          <p className="page-subtitle">
            {vehicle.make} {vehicle.model}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      <section className="card-padded mb-6">
        <h2 className="section-title mb-4">Avancement</h2>
        <WorkflowProgress status={vehicle.status} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-padded">
          <h2 className="section-title">Informations</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">VIN</dt>
              <dd className="font-medium text-slate-900">{vehicle.vin ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Client</dt>
              <dd className="font-medium text-slate-900">{vehicle.client_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Arrivée</dt>
              <dd className="font-medium text-slate-900">{vehicle.arrival_date}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">VEI</dt>
              <dd className="font-medium text-slate-900">
                {vehicle.vei_procedure ? "Oui" : "Non"}
              </dd>
            </div>
            {mechanicName && (
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Mécanicien</dt>
                <dd className="font-medium text-slate-900">{mechanicName}</dd>
              </div>
            )}
            {vehicle.notes && (
              <div>
                <dt className="text-slate-500">Notes</dt>
                <dd className="mt-1 leading-relaxed text-slate-900">{vehicle.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card-padded">
          <h2 className="section-title">Historique</h2>
          <ul className="mt-4 max-h-96 space-y-3 overflow-auto text-sm scrollbar-thin">
            {timeline.map((e) => (
              <li key={e.id} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="font-medium text-slate-900">{timelineLabel(e)}</p>
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

      {photos.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-4">Photos réception</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((src) => (
              <img
                key={src}
                src={src}
                alt="Photo véhicule"
                className="aspect-square rounded-lg border border-slate-200 object-cover shadow-sm"
              />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
