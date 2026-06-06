"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { PhotoUpload } from "@/components/PhotoUpload";
import { MANAGER_NAV } from "@/lib/manager";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import { VEI_STATUS_LABELS } from "@/lib/constants";
import type { SessionUser, Vehicle } from "@/lib/types";

const VEI_STATUSES = ["to_schedule", "scheduled", "completed"] as const;

export default function ReceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [vin, setVin] = useState("");
  const [receptionNotes, setReceptionNotes] = useState("");
  const [error, setError] = useState("");
  const [receptionFeedback, setReceptionFeedback] = useState("");
  const [veiFeedback, setVeiFeedback] = useState("");
  const [savingReception, setSavingReception] = useState(false);
  const [savingVei, setSavingVei] = useState(false);
  const [vei, setVei] = useState<{
    status: string;
    expert_name: string;
    appointment_date: string;
    appointment_time: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).single();
    setVehicle(v as Vehicle);
    setVin(v?.vin ?? "");
    setReceptionNotes(v?.workshop_notes ?? "");
    const { count } = await supabase
      .from("vehicle_photos")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", id)
      .eq("photo_type", "exterior");
    setPhotoCount(count ?? 0);
    if (v?.vei_procedure) {
      const { data: vc } = await supabase
        .from("vei_cases")
        .select("*")
        .eq("vehicle_id", id)
        .single();
      if (vc) {
        setVei({
          status: vc.status,
          expert_name: vc.expert_name ?? "",
          appointment_date: vc.appointment_date ?? "",
          appointment_time: vc.appointment_time ?? "",
          notes: vc.notes ?? "",
        });
      }
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function savePhotos(paths: string[], photoType: "exterior" | "exterior_extra" = "exterior") {
    if (!user) return;
    await supabase.from("vehicle_photos").insert(
      paths.map((p) => ({
        vehicle_id: id,
        storage_path: p,
        photo_type: photoType,
        uploaded_by: user.id,
      }))
    );
    setReceptionFeedback("Photos enregistrées.");
    setError("");
    await load();
  }

  async function saveReception() {
    if (!user) return;
    setSavingReception(true);
    setReceptionFeedback("");
    setError("");
    try {
      await supabase
        .from("vehicles")
        .update({
          vin: vin.trim() || null,
          workshop_notes: receptionNotes || null,
        })
        .eq("id", id);
      setReceptionFeedback("Réception enregistrée (VIN et notes).");
      await load();
    } catch {
      setReceptionFeedback("");
      setError("Impossible d'enregistrer la réception.");
    } finally {
      setSavingReception(false);
    }
  }

  async function saveVei() {
    if (!vei) return;
    setSavingVei(true);
    setVeiFeedback("");
    setError("");
    try {
      await supabase
        .from("vei_cases")
        .update({
          expert_name: vei.expert_name,
          appointment_date: vei.appointment_date || null,
          appointment_time: vei.appointment_time || null,
          notes: vei.notes,
          status: vei.status,
        })
        .eq("vehicle_id", id);
      setVeiFeedback("Planification VEI enregistrée.");
      await load();
    } catch {
      setVeiFeedback("");
      setError("Impossible d'enregistrer la planification VEI.");
    } finally {
      setSavingVei(false);
    }
  }

  async function sendToWorkshop() {
    if (!user || !vehicle) return;
    setError("");
    setReceptionFeedback("");
    setVeiFeedback("");
    if (!vin.trim()) {
      setError("Le numéro VIN / série est requis.");
      return;
    }
    if (photoCount < 4) {
      setError("Minimum 4 photos extérieures requises.");
      return;
    }
    if (
      vehicle.vei_procedure &&
      vei?.status !== "completed" &&
      vei?.status !== "scheduled"
    ) {
      setError("Planifiez ou réalisez l'expertise VEI avant d'envoyer à l'atelier.");
      return;
    }

    await supabase
      .from("vehicles")
      .update({ vin: vin.trim(), workshop_notes: receptionNotes || null })
      .eq("id", id);
    await updateVehicleStatus(id, "in_workshop", user);
    router.push("/workshop/assign");
  }

  if (!user || !vehicle) return <LoadingPage />;

  if (vehicle.status !== "arrived") {
    return (
      <AppShell user={user} nav={[...MANAGER_NAV]}>
        <Alert variant="warning" className="mb-4">
          Ce véhicule n&apos;est plus en statut « Arrivé ».
        </Alert>
        <button
          type="button"
          onClick={() => router.push("/workshop/reception")}
          className="btn-secondary"
        >
          Retour à la réception
        </button>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <div className="mb-6">
        <h1 className="page-title">{vehicle.license_plate}</h1>
        <p className="page-subtitle">
          {vehicle.make} {vehicle.model}
        </p>
      </div>

      <div className="card-padded space-y-5">
        <h2 className="section-title">Réception véhicule</h2>
        <p className="text-sm text-slate-500">
          Complétez et enregistrez cette section indépendamment.
        </p>

        <label className="label-field">
          Numéro de série / VIN
          <input
            className="input-field mt-1.5"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
          />
        </label>

        <label className="label-field">
          Notes de réception
          <textarea
            className="input-field mt-1.5 resize-y"
            rows={3}
            value={receptionNotes}
            onChange={(e) => setReceptionNotes(e.target.value)}
            placeholder="Observations à la réception…"
          />
        </label>

        <div>
          <p className="text-sm font-medium text-slate-700">
            Photos extérieures : {photoCount} / 4 minimum
          </p>
          {photoCount < 4 && (
            <p className="mt-1 text-xs text-amber-700">
              Ajoutez encore {4 - photoCount} photo(s) pour envoyer à l&apos;atelier.
            </p>
          )}
        </div>

        <PhotoUpload
          bucket="vehicle-photos"
          pathPrefix={id}
          onUploaded={savePhotos}
          label="Photos extérieures"
        />

        <PhotoUpload
          bucket="vehicle-photos"
          pathPrefix={`${id}/extra`}
          onUploaded={(paths) => savePhotos(paths, "exterior_extra")}
          label="Photos supplémentaires (optionnel)"
        />

        {receptionFeedback && (
          <Alert variant="success">{receptionFeedback}</Alert>
        )}

        <button
          type="button"
          onClick={saveReception}
          disabled={savingReception}
          className="btn-secondary w-full"
        >
          {savingReception ? "Enregistrement…" : "Enregistrer la réception"}
        </button>
      </div>

      {vehicle.vei_procedure && (
        <>
          <Alert variant="warning" className="mb-4 mt-6 font-medium">
            Ce véhicule nécessite une expertise VEI
          </Alert>

          {vei && (
            <div className="card-padded space-y-4">
              <h2 className="section-title">Expertise VEI</h2>
              <p className="text-sm text-slate-500">
                Complétez et enregistrez cette section indépendamment.
              </p>

              <p className="text-sm font-medium text-slate-700">
                Statut expertise :{" "}
                <span className="text-amber-800">
                  {VEI_STATUS_LABELS[vei.status] ?? vei.status}
                </span>
              </p>
              <label className="label-field">
                Nom de l&apos;expert
                <input
                  className="input-field mt-1.5"
                  value={vei.expert_name}
                  onChange={(e) => setVei({ ...vei, expert_name: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="label-field">
                  Date expertise
                  <input
                    type="date"
                    className="input-field mt-1.5"
                    value={vei.appointment_date}
                    onChange={(e) =>
                      setVei({ ...vei, appointment_date: e.target.value })
                    }
                  />
                </label>
                <label className="label-field">
                  Heure expertise
                  <input
                    type="time"
                    className="input-field mt-1.5"
                    value={vei.appointment_time}
                    onChange={(e) =>
                      setVei({ ...vei, appointment_time: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="label-field">
                Notes expertise
                <textarea
                  className="input-field mt-1.5 resize-y"
                  value={vei.notes}
                  onChange={(e) => setVei({ ...vei, notes: e.target.value })}
                />
              </label>
              <label className="label-field">
                Statut
                <select
                  className="input-field mt-1.5"
                  value={vei.status}
                  onChange={(e) => setVei({ ...vei, status: e.target.value })}
                >
                  {VEI_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {VEI_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>

              {veiFeedback && <Alert variant="success">{veiFeedback}</Alert>}

              <button
                type="button"
                onClick={saveVei}
                disabled={savingVei}
                className="btn-warning w-full"
              >
                {savingVei ? "Enregistrement…" : "Enregistrer planification VEI"}
              </button>
            </div>
          )}
        </>
      )}

      <div className={`space-y-4 ${vehicle.vei_procedure ? "card-padded mt-6" : "mt-6"}`}>
        {vehicle.vei_procedure && (
          <>
            <h2 className="section-title">Finaliser</h2>
            <p className="text-sm text-slate-500">
              Les deux sections doivent être complètes avant l&apos;envoi à
              l&apos;atelier.
            </p>
          </>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        <button type="button" onClick={sendToWorkshop} className="btn-primary-block">
          Envoyer à l&apos;atelier
        </button>
      </div>
    </AppShell>
  );
}
