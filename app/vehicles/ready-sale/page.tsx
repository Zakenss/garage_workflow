"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
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
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markWashed(v: Vehicle) {
    await supabase
      .from("vehicles")
      .update({ washed_at: new Date().toISOString() })
      .eq("id", v.id);
    setFeedback("Véhicule marqué comme lavé.");
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
    setFeedback("Photos finales enregistrées.");
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
    setFeedback(
      status === "for_sale"
        ? "Véhicule mis en vente."
        : status === "reserved"
          ? "Véhicule marqué comme réservé."
          : "Véhicule marqué comme vendu."
    );
    load();
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[{ href: "/vehicles/ready-sale", label: "Préparation vente" }]}
    >
      <PageHeader
        title="Préparation vente"
        subtitle="Lavage, expert et mise en vente"
      />

      <Alert variant="warning" className="mb-6">
        Véhicule prêt pour lavage et mise en vente
      </Alert>

      {feedback && !selected && (
        <Alert variant="success" className="mb-6">
          {feedback}
        </Alert>
      )}

      {!selected ? (
        loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            title="Aucun véhicule à préparer"
            description="Les véhicules validés par l'atelier apparaîtront ici."
          />
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setSelected(v);
                  setFeedback("");
                }}
                className="card-interactive"
              >
                <p className="font-semibold">{v.license_plate}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {v.make} {v.model} · {v.status}
                </p>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="card-padded space-y-5">
          <div>
            <p className="text-lg font-semibold">{selected.license_plate}</p>
            <p className="text-sm text-slate-600">
              {selected.make} {selected.model}
            </p>
          </div>

          {feedback && (
            <Alert variant="success">{feedback}</Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              placeholder="Expert fin de travaux"
              className="input-field"
              value={expert.name}
              onChange={(e) => setExpert({ ...expert, name: e.target.value })}
            />
            <input
              type="date"
              className="input-field"
              value={expert.date}
              onChange={(e) => setExpert({ ...expert, date: e.target.value })}
              aria-label="Date expert"
            />
            <input
              type="time"
              className="input-field"
              value={expert.time}
              onChange={(e) => setExpert({ ...expert, time: e.target.value })}
              aria-label="Heure expert"
            />
          </div>

          <button
            type="button"
            onClick={() => markWashed(selected)}
            className="btn-secondary w-full"
          >
            Marquer lavé
          </button>

          <PhotoUpload
            bucket="vehicle-photos"
            pathPrefix={`${selected.id}/final`}
            label="Photos finales"
            onUploaded={saveFinalPhotos}
          />

          <label className="label-field">
            Notes (réservé / vendu)
            <textarea
              className="input-field mt-1.5 resize-y"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setStatus(selected, "for_sale")}
              className="btn-success !w-full"
            >
              Mis en vente
            </button>
            <button
              type="button"
              onClick={() => setStatus(selected, "reserved")}
              className="btn bg-cyan-700 text-white hover:bg-cyan-800 focus-visible:ring-cyan-600 !w-full"
            >
              Réservé
            </button>
            <button
              type="button"
              onClick={() => setStatus(selected, "sold")}
              className="btn-primary-block"
            >
              Vendu
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setFeedback("");
            }}
            className="btn-ghost w-full"
          >
            Retour à la liste
          </button>
        </div>
      )}
    </AppShell>
  );
}
