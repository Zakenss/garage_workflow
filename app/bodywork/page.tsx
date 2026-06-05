"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
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

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell user={user} nav={[{ href: "/bodywork", label: "Carrosserie" }]}>
      <h1 className="mb-6 text-2xl font-bold">Carrosserie</h1>

      {!selected ? (
        <div className="space-y-3">
          {items.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setSelected(b);
                setNotes(b.notes ?? "");
              }}
              className="block w-full rounded-xl border bg-white p-4 text-left hover:bg-slate-50"
            >
              <p className="font-semibold">{b.vehicles.license_plate}</p>
              <p className="text-sm text-slate-600">
                {b.vehicles.make} {b.vehicles.model}
              </p>
            </button>
          ))}
          {items.length === 0 && (
            <p className="text-slate-500">Aucune carrosserie assignée.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border bg-white p-6">
          <p className="font-semibold">{selected.vehicles.license_plate}</p>
          <textarea
            className="w-full rounded-lg border px-3 py-2"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes carrosserie"
          />
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex-1 rounded-lg border py-2"
            >
              Retour
            </button>
            {selected.status === "not_started" && (
              <button
                type="button"
                onClick={start}
                className="flex-1 rounded-lg bg-slate-900 py-2 text-white"
              >
                Démarrer
              </button>
            )}
            {selected.status === "in_progress" && (
              <button
                type="button"
                onClick={complete}
                className="flex-1 rounded-lg bg-emerald-700 py-2 text-white"
              >
                Terminer carrosserie
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
