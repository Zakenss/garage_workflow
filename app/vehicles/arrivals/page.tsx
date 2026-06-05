"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { addTimeline, notifyRole } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export default function ArrivalsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [form, setForm] = useState({
    license_plate: "",
    make: "",
    model: "",
    vin: "",
    arrival_date: new Date().toISOString().slice(0, 10),
    client_name: "",
    provenance: "",
    vei_procedure: false,
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage("");
    try {
      const { data: vehicle, error } = await supabase
        .from("vehicles")
        .insert({
          license_plate: form.license_plate.toUpperCase(),
          make: form.make,
          model: form.model,
          vin: form.vin || null,
          arrival_date: form.arrival_date,
          client_name: form.client_name || null,
          provenance: form.provenance || null,
          vei_procedure: form.vei_procedure,
          notes: form.notes || null,
          status: "arrived",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await addTimeline(vehicle.id, user.id, "vehicle_arrived", form);

      if (form.vei_procedure) {
        await supabase.from("vei_cases").insert({ vehicle_id: vehicle.id });
        await notifyRole(
          "workshop_manager",
          "vei_new",
          `Nouveau véhicule VEI : ${form.license_plate}`,
          vehicle.id
        );
      }

      await notifyRole(
        "workshop_manager",
        "new_arrival",
        `Nouvel arrivage : ${form.license_plate}`,
        vehicle.id
      );

      setMessage("Véhicule enregistré avec succès.");
      setForm({
        license_plate: "",
        make: "",
        model: "",
        vin: "",
        arrival_date: new Date().toISOString().slice(0, 10),
        client_name: "",
        provenance: "",
        vei_procedure: false,
        notes: "",
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell user={user} nav={[{ href: "/vehicles/arrivals", label: "Arrivées" }]}>
      <h1 className="mb-6 text-2xl font-bold">Arrivée véhicule</h1>

      {message && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-6">
        <Field label="Immatriculation *" required>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.license_plate}
            onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marque *" required>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
              required
            />
          </Field>
          <Field label="Modèle *" required>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="VIN / N° série">
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.vin}
            onChange={(e) => setForm({ ...form, vin: e.target.value })}
          />
        </Field>
        <Field label="Date d'arrivée *">
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.arrival_date}
            onChange={(e) => setForm({ ...form, arrival_date: e.target.value })}
            required
          />
        </Field>
        <Field label="Client / provenance">
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
          />
        </Field>
        <Field label="Provenance (complément)">
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.provenance}
            onChange={(e) => setForm({ ...form, provenance: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.vei_procedure}
            onChange={(e) => setForm({ ...form, vei_procedure: e.target.checked })}
          />
          Procédure VEI
        </label>
        <Field label="Notes">
          <textarea
            className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-white disabled:opacity-60"
        >
          {loading ? "Enregistrement…" : "Créer fiche — Statut Arrivé"}
        </button>
      </form>

    </AppShell>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {required && " *"}
      {children}
    </label>
  );
}
