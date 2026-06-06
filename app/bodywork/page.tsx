"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { PhotoUpload } from "@/components/PhotoUpload";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

type BodyworkRow = {
  id: string;
  status: string;
  notes: string | null;
  vehicle_id: string;
  vehicles: { license_plate: string; make: string; model: string };
};

export default function BodyworkPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<BodyworkRow[]>([]);
  const [selected, setSelected] = useState<BodyworkRow | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("bodywork")
      .select("*, vehicles(license_plate, make, model)")
      .eq("bodyworker_id", user.id)
      .neq("status", "completed")
      .order("created_at", { ascending: false });
    setItems((data as BodyworkRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function savePhotos(paths: string[], type: "before" | "after") {
    if (!selected) return;
    await supabase.from("bodywork_photos").insert(
      paths.map((p) => ({
        bodywork_id: selected.id,
        storage_path: p,
        photo_type: type,
      }))
    );
  }

  async function start() {
    if (!selected || !user) return;
    await supabase
      .from("bodywork")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        notes,
      })
      .eq("id", selected.id);
    await updateVehicleStatus(selected.vehicle_id, "bodywork_in_progress", user);
    load();
  }

  async function complete() {
    if (!selected || !user) return;
    await supabase
      .from("bodywork")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        notes,
      })
      .eq("id", selected.id);
    await updateVehicleStatus(selected.vehicle_id, "bodywork_complete", user);
    setSelected(null);
    load();
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[{ href: "/bodywork", label: "Carrosserie" }]}>
      <PageHeader
        title="Carrosserie"
        subtitle="Photos avant/après et suivi des travaux"
      />

      {!selected ? (
        loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucune carrosserie assignée"
            description="Les véhicules vous seront assignés par le chef d'atelier."
          />
        ) : (
          <div className="space-y-3">
            {items.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelected(b);
                  setNotes(b.notes ?? "");
                }}
                className="card-interactive"
              >
                <p className="font-semibold">{b.vehicles.license_plate}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {b.vehicles.make} {b.vehicles.model}
                </p>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="card-padded space-y-5">
          <div>
            <p className="text-lg font-semibold">{selected.vehicles.license_plate}</p>
            <p className="text-sm text-slate-600">
              {selected.vehicles.make} {selected.vehicles.model}
            </p>
          </div>
          <label className="label-field">
            Notes carrosserie
            <textarea
              className="input-field mt-1.5 resize-y"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <PhotoUpload
            bucket="bodywork-photos"
            pathPrefix={selected.id}
            label="Photos avant"
            onUploaded={(p) => savePhotos(p, "before")}
          />
          <PhotoUpload
            bucket="bodywork-photos"
            pathPrefix={selected.id}
            label="Photos après"
            onUploaded={(p) => savePhotos(p, "after")}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="btn-secondary flex-1"
            >
              Retour
            </button>
            {selected.status === "not_started" && (
              <button type="button" onClick={start} className="btn-primary-block flex-1">
                Démarrer
              </button>
            )}
            {selected.status === "in_progress" && (
              <button type="button" onClick={complete} className="btn-success flex-1 !w-full">
                Terminer carrosserie
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
