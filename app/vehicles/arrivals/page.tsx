"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { addTimeline, notifyRole } from "@/lib/db";
import { SECRETARY_NAV } from "@/lib/secretary";
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
  const [messageType, setMessageType] = useState<"success" | "error">("success");
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

      setMessageType("success");
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
      setMessageType("error");
      setMessage(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...SECRETARY_NAV]}>
      <PageHeader
        title="Arrivée véhicule"
        subtitle="Créer une fiche et notifier le chef d'atelier"
      />

      {message && (
        <Alert variant={messageType} className="mb-6">
          {message}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="card-padded space-y-5">
        <Field label="Immatriculation" required>
          <input
            className="input-field mt-1.5"
            value={form.license_plate}
            onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
            placeholder="AB-123-CD"
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Marque" required>
            <input
              className="input-field mt-1.5"
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
              required
            />
          </Field>
          <Field label="Modèle" required>
            <input
              className="input-field mt-1.5"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="VIN / N° série">
          <input
            className="input-field mt-1.5"
            value={form.vin}
            onChange={(e) => setForm({ ...form, vin: e.target.value })}
          />
        </Field>
        <Field label="Date d'arrivée" required>
          <input
            type="date"
            className="input-field mt-1.5"
            value={form.arrival_date}
            onChange={(e) => setForm({ ...form, arrival_date: e.target.value })}
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Client">
            <input
              className="input-field mt-1.5"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            />
          </Field>
          <Field label="Provenance">
            <input
              className="input-field mt-1.5"
              value={form.provenance}
              onChange={(e) => setForm({ ...form, provenance: e.target.value })}
            />
          </Field>
        </div>
        <label className="checkbox-field px-2">
          <input
            type="checkbox"
            checked={form.vei_procedure}
            onChange={(e) => setForm({ ...form, vei_procedure: e.target.checked })}
          />
          Procédure VEI
        </label>
        <Field label="Notes">
          <textarea
            className="input-field mt-1.5 min-h-[100px] resize-y"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <button type="submit" disabled={loading} className="btn-primary-block">
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
    <label className="label-field">
      {label}
      {required && <span className="text-red-500"> *</span>}
      {children}
    </label>
  );
}
