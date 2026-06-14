"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { PhotoUpload } from "@/components/PhotoUpload";
import { StatusBadge } from "@/components/StatusBadge";
import { MechanicSlotButtons } from "@/components/MechanicSlotButtons";
import { VeiStatusPicker } from "@/components/VeiStatusPicker";
import { MANAGER_NAV } from "@/lib/manager";
import { assignVehicleToMechanic, updateVeiStatus, type VeiStatus } from "@/lib/manager-actions";
import {
  isReceptionComplete,
  isVeiReadyForWorkshop,
  needsVeiBeforeWorkshop,
} from "@/lib/manager-pipeline";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import { VEI_STATUS_LABELS } from "@/lib/constants";
import type { User, Vehicle } from "@/lib/types";

export default function ReceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [vin, setVin] = useState("");
  const [receptionNotes, setReceptionNotes] = useState("");
  const [error, setError] = useState("");
  const [receptionFeedback, setReceptionFeedback] = useState("");
  const [veiFeedback, setVeiFeedback] = useState("");
  const [savingReception, setSavingReception] = useState(false);
  const [savingVei, setSavingVei] = useState(false);
  const [veiCaseId, setVeiCaseId] = useState<string | null>(null);
  const [vei, setVei] = useState<{
    status: string;
    expert_name: string;
    appointment_date: string;
    appointment_time: string;
    notes: string;
  } | null>(null);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [assigning, setAssigning] = useState(false);

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
        setVeiCaseId(vc.id);
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
    supabase
      .from("users")
      .select("id, full_name, mechanic_slot")
      .eq("role", "mechanic")
      .eq("active", true)
      .order("mechanic_slot")
      .then(({ data }) => setMechanics((data as User[]) ?? []));
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

  async function changeVeiStatus(status: VeiStatus) {
    if (!user || !vei || !veiCaseId || vei.status === status) return;
    setSavingVei(true);
    setVeiFeedback("");
    try {
      await updateVeiStatus(veiCaseId, status, user, id);
      setVei({ ...vei, status });
      setVeiFeedback(`Statut VEI : ${VEI_STATUS_LABELS[status]}`);
    } catch {
      setError("Impossible de mettre à jour le statut VEI.");
    } finally {
      setSavingVei(false);
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
    if (!isReceptionComplete({ vin }, photoCount)) {
      setError("Le numéro VIN / série et 4 photos extérieures sont requis.");
      return;
    }
    if (needsVeiBeforeWorkshop(vehicle) && !isVeiReadyForWorkshop(vei?.status)) {
      setError("Planifiez ou réalisez l'expertise VEI avant d'envoyer à l'atelier.");
      return;
    }

    await supabase
      .from("vehicles")
      .update({ vin: vin.trim(), workshop_notes: receptionNotes || null })
      .eq("id", id);
    await updateVehicleStatus(id, "in_workshop", user);
    router.push(`/workshop/in-workshop?new=${id}&tab=assign`);
  }

  async function assignFromReception(mechanicId: string) {
    if (!user || !vehicle) return;
    setAssigning(true);
    try {
      await assignVehicleToMechanic(vehicle.id, mechanicId, user, {
        licensePlate: vehicle.license_plate,
      });
      router.push("/workshop/in-workshop?tab=active");
    } finally {
      setAssigning(false);
    }
  }

  if (!user || !vehicle) return <LoadingPage />;

  const isArrived = vehicle.status === "arrived";
  const awaitingAssign = vehicle.status === "in_workshop";
  const receptionComplete = isReceptionComplete(
    isArrived ? { vin } : vehicle,
    photoCount
  );
  const veiRequired = needsVeiBeforeWorkshop(vehicle);
  const veiReady = isVeiReadyForWorkshop(vei?.status);
  const canSendToWorkshop =
    isArrived &&
    receptionComplete &&
    (!veiRequired || veiReady);

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">{vehicle.license_plate}</h1>
          <p className="page-subtitle">
            {vehicle.make} {vehicle.model}
          </p>
          {isArrived && (
            <p className="mt-2 text-sm text-slate-600">
              {veiRequired
                ? "Étape 1 : Réception → Étape 2 : VEI → Étape 3 : À assigner"
                : "Étape 1 : Réception → Étape 2 : À assigner"}
            </p>
          )}
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {!isArrived && !awaitingAssign && (
        <Alert variant="info" className="mb-6">
          Réception terminée. Vous pouvez toujours modifier le statut VEI ci-dessous.
        </Alert>
      )}

      {awaitingAssign && (
        <Alert variant="success" className="mb-6">
          Ce véhicule est en atelier — assignez-le à un mécanicien ci-dessous ou via
          l&apos;onglet <strong>Atelier → À assigner</strong>.
        </Alert>
      )}

      {awaitingAssign && (
        <div className="card-padded mb-6 space-y-4">
          <h2 className="section-title">Assigner à un mécanicien</h2>
          <p className="text-sm text-slate-500">
            Cliquez sur Mécan. 1, 2 ou 3 — statut « Diagnostic assigné » et notification
            au mécanicien.
          </p>
          <MechanicSlotButtons
            mechanics={mechanics}
            disabled={assigning}
            onAssign={(mechanicId) => assignFromReception(mechanicId)}
          />
          <button
            type="button"
            onClick={() => router.push(`/workshop/in-workshop?new=${id}&tab=assign`)}
            className="btn-secondary w-full"
          >
            Ouvrir dans Atelier
          </button>
        </div>
      )}

      {vehicle.vei_procedure && isArrived && !receptionComplete && (
        <Alert variant="info" className="mb-4">
          Terminez d&apos;abord la réception (VIN + 4 photos) avant l&apos;expertise VEI.
        </Alert>
      )}

      {vehicle.vei_procedure && receptionComplete && isArrived && !veiReady && (
        <Alert variant="warning" className="mb-4 font-medium">
          Réception terminée — planifiez ou réalisez l&apos;expertise VEI avant l&apos;assignation.
        </Alert>
      )}

      {isArrived ? (
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
      ) : (
        <div className="card-padded mb-6 space-y-2 text-sm">
          <p>
            <span className="text-slate-500">VIN :</span>{" "}
            <span className="font-medium">{vehicle.vin ?? "—"}</span>
          </p>
          <p>
            <span className="text-slate-500">Photos :</span>{" "}
            <span className="font-medium">{photoCount}</span>
          </p>
          {vehicle.workshop_notes && (
            <p>
              <span className="text-slate-500">Notes :</span> {vehicle.workshop_notes}
            </p>
          )}
        </div>
      )}

      {vehicle.vei_procedure && (receptionComplete || !isArrived) && (
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
                Statut actuel :{" "}
                <span className="text-amber-800">
                  {VEI_STATUS_LABELS[vei.status] ?? vei.status}
                </span>
              </p>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Changer le statut (1 clic)
                </p>
                <VeiStatusPicker
                  status={vei.status}
                  disabled={savingVei}
                  onChange={changeVeiStatus}
                />
              </div>

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

              {veiFeedback && <Alert variant="success">{veiFeedback}</Alert>}

              <button
                type="button"
                onClick={saveVei}
                disabled={savingVei}
                className="btn-secondary w-full"
              >
                {savingVei ? "Enregistrement…" : "Enregistrer détails VEI"}
              </button>

              {isArrived && veiReady && (
                <p className="text-sm text-emerald-700">
                  Expertise VEI prête — vous pouvez envoyer le véhicule à l&apos;atelier.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {isArrived && (
      <div className={`space-y-4 ${vehicle.vei_procedure && receptionComplete ? "card-padded mt-6" : "mt-6"}`}>
        {receptionComplete && (
          <>
            <h2 className="section-title">Finaliser</h2>
            <p className="text-sm text-slate-500">
              {veiRequired && !veiReady
                ? "Complétez l'expertise VEI ci-dessus avant l'envoi à l'atelier."
                : "Envoyez le véhicule à l'atelier pour l'assigner à un mécanicien."}
            </p>
          </>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        {canSendToWorkshop ? (
          <button type="button" onClick={sendToWorkshop} className="btn-primary-block">
            Envoyer à l&apos;atelier
          </button>
        ) : (
          <p className="text-sm text-slate-500">
            {!receptionComplete
              ? "VIN et 4 photos extérieures requis pour continuer."
              : veiRequired && !veiReady
                ? "Expertise VEI requise avant l'envoi à l'atelier."
                : null}
          </p>
        )}
        {receptionComplete && veiRequired && !veiReady && (
          <button
            type="button"
            onClick={() => router.push("/workshop/vei")}
            className="btn-secondary w-full"
          >
            Ouvrir la liste VEI
          </button>
        )}
      </div>
      )}

      {!isArrived && !awaitingAssign && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/workshop/in-workshop")}
            className="btn-secondary"
          >
            Voir atelier
          </button>
          <button
            type="button"
            onClick={() => router.push("/workshop/vei")}
            className="btn-ghost"
          >
            Liste VEI
          </button>
        </div>
      )}
    </AppShell>
  );
}
