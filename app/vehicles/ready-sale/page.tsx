"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PhotoUpload } from "@/components/PhotoUpload";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function ReadySalePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [expert, setExpert] = useState({ name: "", date: "", time: "" });
  const [saleNotes, setSaleNotes] = useState("");

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .in("status", ["ready_to_sell", "for_sale", "reserved", "sold"])
      .order("ready_at", { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markWashed(v: Vehicle) {
    await supabase
      .from("vehicles")
      .update({ washed_at: new Date().toISOString() })
      .eq("id", v.id);
    load();
  }

  async function saveFinalPhotos(paths: string[]) {
    if (!selected || !user) return;
    await supabase.from("vehicle_photos").insert(
      paths.map((p) => ({
        vehicle_id: selected.id,
        storage_path: p,
        photo_type: "final",
        uploaded_by: user.id,
      }))
    );
  }

  async function setStatus(
    v: Vehicle,
    status: "for_sale" | "reserved" | "sold"
  ) {
    const extra: Record<string, string> = {
      sale_notes: saleNotes,
      seller_expert_name: expert.name || "",
    };
    if (expert.date) extra.seller_expert_date = expert.date;
    if (expert.time) extra.seller_expert_time = expert.time;
    if (status === "for_sale") extra.listed_at = new Date().toISOString();
    if (status === "reserved") extra.reserved_at = new Date().toISOString();
    if (status === "sold") extra.sold_at = new Date().toISOString();

    await supabase.from("vehicles").update(extra).eq("id", v.id);
    await updateVehicleStatus(v.id, status, user);
    setSelected(null);
    load();
  }

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[{ href: "/vehicles/ready-sale", label: "Préparation vente" }]}
    >
      <h1 className="mb-2 text-2xl font-bold">Préparation vente</h1>
      <p className="mb-6 text-sm text-amber-800 rounded-lg bg-amber-50 p-3">
        Véhicule prêt pour lavage et mise en vente
      </p>

      {!selected ? (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v)}
              className="block w-full rounded-xl border bg-white p-4 text-left"
            >
              <p className="font-semibold">{v.license_plate}</p>
              <p className="text-sm text-slate-600">
                {v.make} {v.model} · {v.status}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border bg-white p-6">
          <p className="font-semibold text-lg">{selected.license_plate}</p>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              placeholder="Expert fin de travaux"
              className="rounded border px-3 py-2 text-sm"
              value={expert.name}
              onChange={(e) => setExpert({ ...expert, name: e.target.value })}
            />
            <input
              type="date"
              className="rounded border px-3 py-2 text-sm"
              value={expert.date}
              onChange={(e) => setExpert({ ...expert, date: e.target.value })}
            />
            <input
              type="time"
              className="rounded border px-3 py-2 text-sm"
              value={expert.time}
              onChange={(e) => setExpert({ ...expert, time: e.target.value })}
            />
          </div>

          <button
            type="button"
            onClick={() => markWashed(selected)}
            className="w-full rounded-lg border py-2"
          >
            Marquer lavé
          </button>

          <PhotoUpload
            bucket="vehicle-photos"
            pathPrefix={`${selected.id}/final`}
            label="Photos finales"
            onUploaded={saveFinalPhotos}
          />

          <textarea
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Notes (réservé / vendu)"
            value={saleNotes}
            onChange={(e) => setSaleNotes(e.target.value)}
          />

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setStatus(selected, "for_sale")}
              className="rounded-lg bg-green-700 py-2 text-white text-sm"
            >
              Mis en vente
            </button>
            <button
              type="button"
              onClick={() => setStatus(selected, "reserved")}
              className="rounded-lg bg-cyan-700 py-2 text-white text-sm"
            >
              Réservé
            </button>
            <button
              type="button"
              onClick={() => setStatus(selected, "sold")}
              className="rounded-lg bg-slate-800 py-2 text-white text-sm"
            >
              Vendu
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm text-slate-500 underline"
          >
            Retour
          </button>
        </div>
      )}
    </AppShell>
  );
}
