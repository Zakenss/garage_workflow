"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { StatusBadge } from "@/components/StatusBadge";
import { VeiStatusPicker } from "@/components/VeiStatusPicker";
import { VEI_STATUS_LABELS } from "@/lib/constants";
import {
  saveVeiCaseDetails,
  sendVehicleToWorkshop,
  type VeiCaseInput,
  type VeiStatus,
} from "@/lib/manager-actions";
import {
  isReceptionComplete,
  isVeiCaseComplete,
} from "@/lib/manager-pipeline";
import { MANAGER_NAV } from "@/lib/manager";
import { useSession } from "@/lib/session-context";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function VeiDetailPage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [veiCaseId, setVeiCaseId] = useState<string | null>(null);
  const [form, setForm] = useState<VeiCaseInput | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data: v } = await supabase.from("vehicles").select("*").eq("id", vehicleId).single();
    setVehicle(v as Vehicle);

    const { count } = await supabase
      .from("vehicle_photos")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .eq("photo_type", "exterior");
    setPhotoCount(count ?? 0);

    const { data: vc } = await supabase
      .from("vei_cases")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (vc) {
      setVeiCaseId(vc.id);
      setForm({
        expert_name: vc.expert_name ?? "",
        appointment_date: vc.appointment_date ?? "",
        appointment_time: vc.appointment_time ?? "",
        notes: vc.notes ?? "",
        status: vc.status as VeiStatus,
      });
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`vei-detail-${vehicleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vei_cases", filter: `vehicle_id=eq.${vehicleId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles", filter: `id=eq.${vehicleId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [vehicleId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !veiCaseId || !form) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveVeiCaseDetails(veiCaseId, vehicleId, user, form);
      setMessage("Dossier VEI enregistré.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendToWorkshop() {
    if (!user || !vehicle) return;
    setSending(true);
    setError("");
    setMessage("");
    try {
      await sendVehicleToWorkshop(vehicleId, user, {
        vin: vehicle.vin ?? "",
        workshop_notes: vehicle.workshop_notes,
      });
      router.push(`/workshop/in-workshop?new=${vehicleId}&tab=assign`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer à l'atelier.");
      setSending(false);
    }
  }

  if (!user || !vehicle) return <LoadingPage />;

  if (!vehicle.vei_procedure || !form) {
    return (
      <AppShell user={user} nav={[...MANAGER_NAV]}>
        <Alert variant="error">Ce véhicule n&apos;a pas de procédure VEI.</Alert>
        <Link href="/workshop/vei" className="mt-4 inline-block text-sm underline">
          ← Retour VEI
        </Link>
      </AppShell>
    );
  }

    const receptionDone = isReceptionComplete(
      { vin: vehicle?.vin ?? null },
      photoCount
    );
  const veiComplete = isVeiCaseComplete(form);
  const awaitingAssign =
    vehicle.status === "in_workshop" && !vehicle.assigned_mechanic_id;
  const canSend =
    receptionDone &&
    veiComplete &&
    (vehicle.status === "arrived" || awaitingAssign);

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/workshop/vei" className="text-sm text-slate-500 hover:text-slate-800">
            ← Expertises VEI
          </Link>
          <h1 className="page-title mt-1">{vehicle.license_plate}</h1>
          <p className="page-subtitle">
            {vehicle.make} {vehicle.model}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {message && <Alert variant="success" className="mb-4">{message}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {!receptionDone && (
        <Alert variant="warning" className="mb-4">
          Réception incomplète (VIN + 4 photos) —{" "}
          <Link href={`/workshop/reception/${vehicleId}`} className="font-medium underline">
            compléter la réception
          </Link>{" "}
          avant l&apos;assignation mécanicien.
        </Alert>
      )}

      {receptionDone && !veiComplete && (
        <Alert variant="warning" className="mb-4">
          Le mécanicien ne verra pas ce véhicule tant que la VEI n&apos;est pas{" "}
          <strong>réalisée</strong> avec un <strong>expert renseigné</strong>.
        </Alert>
      )}

      {veiComplete && receptionDone && (
        <Alert variant="success" className="mb-4">
          VEI finalisée — le véhicule peut être assigné à un mécanicien.
        </Alert>
      )}

      <form onSubmit={handleSave} className="card-padded space-y-5">
        <h2 className="section-title">Dossier expertise VEI</h2>

        <p className="text-sm text-slate-600">
          Statut actuel :{" "}
          <span className="font-medium text-amber-900">
            {VEI_STATUS_LABELS[form.status] ?? form.status}
          </span>
        </p>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Statut</p>
          <VeiStatusPicker
            status={form.status}
            disabled={saving}
            onChange={(status) => {
              if (status === "completed" && !form.expert_name.trim()) {
                setError("Renseignez le nom de l'expert avant de marquer la VEI comme réalisée.");
                return;
              }
              setError("");
              setForm({ ...form, status });
            }}
          />
          <p className="mt-2 text-xs text-slate-500">
            « Réalisé » + expert obligatoires pour débloquer l&apos;assignation mécanicien.
          </p>
        </div>

        <label className="label-field">
          Nom de l&apos;expert *
          <input
            className="input-field mt-1.5"
            value={form.expert_name}
            onChange={(e) => setForm({ ...form, expert_name: e.target.value })}
            placeholder="Nom de l'expert présent"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label-field">
            Date expertise
            <input
              type="date"
              className="input-field mt-1.5"
              value={form.appointment_date}
              onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
            />
          </label>
          <label className="label-field">
            Heure expertise
            <input
              type="time"
              className="input-field mt-1.5"
              value={form.appointment_time}
              onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
            />
          </label>
        </div>

        <label className="label-field">
          Notes expertise
          <textarea
            className="input-field mt-1.5 min-h-[100px] resize-y"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Enregistrement…" : "Enregistrer le dossier VEI"}
          </button>
          <Link href={`/workshop/reception/${vehicleId}`} className="btn-secondary inline-flex items-center">
            Modifier la réception
          </Link>
        </div>
      </form>

      {canSend && (
        <div className="card-padded mt-6 space-y-3">
          <h2 className="section-title">Assignation mécanicien</h2>
          <p className="text-sm text-slate-600">
            {awaitingAssign
              ? "Le véhicule est en atelier — ouvrez l'assignation."
              : "Envoyez le véhicule à l'atelier pour l'assigner à un mécanicien."}
          </p>
          {vehicle.status === "arrived" ? (
            <button
              type="button"
              onClick={handleSendToWorkshop}
              disabled={sending}
              className="btn-primary-block"
            >
              {sending ? "Envoi…" : "Envoyer à l'atelier → Assigner"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/workshop/in-workshop?new=${vehicleId}&tab=assign`)}
              className="btn-primary-block"
            >
              Ouvrir l&apos;assignation mécanicien
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
