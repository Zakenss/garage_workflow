"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getPublicUrl, supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

type TimelineEntry = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  users?: { full_name: string } | null;
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  useEffect(() => {
    async function load() {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).single();
      setVehicle(v as Vehicle);
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
  }, [id]);

  if (!user || !vehicle) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: `/vehicles/${id}`, label: vehicle.license_plate },
      ]}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{vehicle.license_plate}</h1>
          <p className="text-slate-600">
            {vehicle.make} {vehicle.model}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Informations</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="text-slate-500">VIN</dt>
              <dd>{vehicle.vin ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Client</dt>
              <dd>{vehicle.client_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Arrivée</dt>
              <dd>{vehicle.arrival_date}</dd>
            </div>
            <div>
              <dt className="text-slate-500">VEI</dt>
              <dd>{vehicle.vei_procedure ? "Oui" : "Non"}</dd>
            </div>
            {vehicle.notes && (
              <div>
                <dt className="text-slate-500">Notes</dt>
                <dd>{vehicle.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Historique</h2>
          <ul className="mt-2 max-h-80 space-y-2 overflow-auto text-sm">
            {timeline.map((e) => (
              <li key={e.id} className="border-b border-slate-100 pb-2">
                <p className="font-medium">{e.action}</p>
                <p className="text-xs text-slate-500">
                  {new Date(e.created_at).toLocaleString("fr-FR")}
                  {e.users?.full_name && ` · ${e.users.full_name}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {photos.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Photos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                className="aspect-square rounded-lg object-cover"
              />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
