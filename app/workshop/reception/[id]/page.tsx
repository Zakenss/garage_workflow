"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { PhotoUpload } from "@/components/PhotoUpload";
import { StatusBadge } from "@/components/StatusBadge";
import { MechanicSlotButtons } from "@/components/MechanicSlotButtons";
import { MANAGER_NAV } from "@/lib/manager";
import { assignVehicleToMechanic, sendVehicleToWorkshop } from "@/lib/manager-actions";
import {
  deleteReceptionPhoto,
  fetchReceptionPhotos,
  isReceptionComplete,
  isVeiCaseComplete,
  needsVeiBeforeWorkshop,
  type ReceptionPhoto,
} from "@/lib/manager-pipeline";
import { addTimeline, notifyRole } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { User, Vehicle } from "@/lib/types";

type VehicleForm = {
  license_plate: string;
  make: string;
  model: string;
  client_name: string;
  provenance: string;
  arrival_date: string;
  notes: string;
  vei_procedure: boolean;
};

export default function ReceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm | null>(null);
  const [photos, setPhotos] = useState<ReceptionPhoto[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [vin, setVin] = useState("");
  const [receptionNotes, setReceptionNotes] = useState("");
  const [veiComplete, setVeiComplete] = useState(false);
  const [error, setError] = useState("");
  const [receptionFeedback, setReceptionFeedback] = useState("");
  const [savingReception, setSavingReception] = useState(false);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [mechanicName, setMechanicName] = useState<string | null>(null);

  async function load() {
    const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).single();
    const veh = v as Vehicle | null;
    setVehicle(veh);
    if (veh) {
      setVehicleForm({
        license_plate: veh.license_plate,
        make: veh.make,
        model: veh.model,
        client_name: veh.client_name ?? "",
        provenance: veh.provenance ?? "",
        arrival_date: veh.arrival_date,
        notes: veh.notes ?? "",
        vei_procedure: veh.vei_procedure,
      });
    }
    if (veh?.assigned_mechanic_id) {
      const { data: mech } = await supabase
        .from("users")
        .select("full_name, mechanic_slot")
        .eq("id", veh.assigned_mechanic_id)
        .single();
      setMechanicName(
        mech
          ? `Mécanicien ${mech.mechanic_slot ?? "?"} — ${mech.full_name}`
          : null
      );
    } else {
      setMechanicName(null);
    }
    const currentVin = veh?.vin ?? "";
    setVin(currentVin);
    setReceptionNotes(veh?.workshop_notes ?? "");

    const photoRows = await fetchReceptionPhotos(id);
    setPhotos(photoRows);
    const exteriorCount = photoRows.filter((p) => p.photo_type === "exterior").length;
    setPhotoCount(exteriorCount);

    if (veh?.vei_procedure) {
      const { data: vc } = await supabase
        .from("vei_cases")
        .select("status, expert_name")
        .eq("vehicle_id", id)
        .maybeSingle();
      setVeiComplete(isVeiCaseComplete(vc));
    } else {
      setVeiComplete(false);
    }

    return {
      vehicle: veh,
      photoCount: exteriorCount,
      vin: currentVin,
    };
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

  async function savePhotos(paths: string[], photoType: "exterior" | "additional" = "exterior") {
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
    const snapshot = await load();
    await tryAutoAdvanceNonVei(snapshot);
  }

  async function tryAutoAdvanceNonVei(
    snapshot?: { vehicle: Vehicle | null; photoCount: number; vin: string }
  ) {
    const v = snapshot?.vehicle ?? vehicle;
    const pc = snapshot?.photoCount ?? photoCount;
    const currentVin = snapshot?.vin ?? vin;
    if (!user || !v || v.vei_procedure) return;
    const complete = isReceptionComplete({ vin: currentVin }, pc);
    if (!complete || v.status !== "arrived") return;

    try {
      await sendVehicleToWorkshop(id, user, {
        vin: currentVin.trim(),
        workshop_notes: receptionNotes || null,
      });
      router.push(`/workshop/in-workshop?new=${id}&tab=assign`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer à l'atelier.");
    }
  }

  async function removePhoto(photoId: string) {
    if (!user) return;
    setDeletingPhotoId(photoId);
    setError("");
    try {
      await deleteReceptionPhoto(photoId);
      setReceptionFeedback("Photo supprimée.");
      await load();
    } catch {
      setError("Impossible de supprimer la photo.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function saveAll() {
    if (!user || !vehicleForm || !vehicle) return;
    setSavingReception(true);
    setReceptionFeedback("");
    setError("");
    try {
      const plate = vehicleForm.license_plate.trim().toUpperCase();
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({
          license_plate: plate,
          make: vehicleForm.make.trim(),
          model: vehicleForm.model.trim(),
          client_name: vehicleForm.client_name.trim() || null,
          provenance: vehicleForm.provenance.trim() || null,
          arrival_date: vehicleForm.arrival_date,
          notes: vehicleForm.notes.trim() || null,
          vin: vin.trim() || null,
          workshop_notes: receptionNotes || null,
          vei_procedure: vehicleForm.vei_procedure,
        })
        .eq("id", id);
      if (updateError) throw updateError;

      if (vehicleForm.vei_procedure && !vehicle.vei_procedure) {
        const { data: existing } = await supabase
          .from("vei_cases")
          .select("id")
          .eq("vehicle_id", id)
          .maybeSingle();
        if (!existing) {
          await supabase.from("vei_cases").insert({ vehicle_id: id });
          await notifyRole(
            "workshop_manager",
            "vei_new",
            `Procédure VEI activée — ${plate}`,
            id
          );
        }
      }

      await addTimeline(id, user.id, "vehicle_updated", { license_plate: plate });
      setReceptionFeedback("Fiche véhicule et réception enregistrées.");
      const snapshot = await load();
      await tryAutoAdvanceNonVei({
        ...snapshot,
        vin: vin.trim() || snapshot.vin,
      });
    } catch (err) {
      setReceptionFeedback("");
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer.");
    } finally {
      setSavingReception(false);
    }
  }

  async function sendToWorkshop() {
    if (!user || !vehicle) return;
    setError("");
    if (!isReceptionComplete({ vin }, photoCount)) {
      setError("Le numéro VIN / série et 4 photos extérieures sont requis.");
      return;
    }
    if (needsVeiBeforeWorkshop(vehicle) && !veiComplete) {
      setError("Finalisez l'expertise VEI sur la page Expertises VEI avant l'assignation.");
      return;
    }

    try {
      await sendVehicleToWorkshop(id, user, {
        vin: vin.trim(),
        workshop_notes: receptionNotes || null,
      });
      router.push(`/workshop/in-workshop?new=${id}&tab=assign`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer à l'atelier.");
    }
  }

  async function assignFromReception(mechanicId: string) {
    if (!user || !vehicle) return;
    setAssigning(true);
    setError("");
    try {
      await assignVehicleToMechanic(vehicle.id, mechanicId, user, {
        licensePlate: vehicle.license_plate,
      });
      router.push("/workshop/in-workshop?tab=active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignation impossible.");
    } finally {
      setAssigning(false);
    }
  }

  if (!user || !vehicle || !vehicleForm) return <LoadingPage />;

  const isArrived = vehicle.status === "arrived";
  const awaitingAssign =
    vehicle.status === "in_workshop" && !vehicle.assigned_mechanic_id;
  const veiRequired = needsVeiBeforeWorkshop({ vei_procedure: vehicleForm.vei_procedure });
  const receptionComplete = isReceptionComplete({ vin }, photoCount);
  const canSendToWorkshop =
    (isArrived || awaitingAssign) &&
    receptionComplete &&
    (!veiRequired || veiComplete);

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/workshop/reception" className="text-sm text-slate-500 hover:text-slate-800">
            ← Réception atelier
          </Link>
          <h1 className="page-title mt-1">{vehicle.license_plate}</h1>
          <p className="page-subtitle">
            {vehicle.make} {vehicle.model}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {mechanicName && (
        <Alert variant="info" className="mb-4">
          Assigné à {mechanicName}. Vous pouvez toujours modifier la fiche et les photos.
        </Alert>
      )}

      {!mechanicName && vehicle.status !== "arrived" && vehicle.status !== "in_workshop" && (
        <Alert variant="info" className="mb-4">
          Véhicule en cours de traitement — modification de la fiche toujours possible.
        </Alert>
      )}

      {receptionComplete && (
        <Alert variant="success" className="mb-4">
          Réception complète (VIN + {photoCount} photos extérieures).
        </Alert>
      )}

      {veiRequired && receptionComplete && !veiComplete && (
        <Alert variant="warning" className="mb-4">
          Expertise VEI en attente — gérez-la sur{" "}
          <Link href={`/workshop/vei/${id}`} className="font-medium underline">
            Expertises VEI
          </Link>
          . Le mécanicien ne verra pas ce véhicule avant finalisation.
        </Alert>
      )}

      {awaitingAssign && (
        <Alert variant="success" className="mb-4">
          En atelier — assignez le véhicule à un mécanicien.
        </Alert>
      )}

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="card-padded mb-6 space-y-4">
        <h2 className="section-title">Informations véhicule</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label-field">
            Immatriculation
            <input
              className="input-field mt-1.5"
              value={vehicleForm.license_plate}
              onChange={(e) =>
                setVehicleForm({ ...vehicleForm, license_plate: e.target.value })
              }
            />
          </label>
          <label className="label-field">
            Date d&apos;arrivée
            <input
              type="date"
              className="input-field mt-1.5"
              value={vehicleForm.arrival_date}
              onChange={(e) =>
                setVehicleForm({ ...vehicleForm, arrival_date: e.target.value })
              }
            />
          </label>
          <label className="label-field">
            Marque
            <input
              className="input-field mt-1.5"
              value={vehicleForm.make}
              onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
            />
          </label>
          <label className="label-field">
            Modèle
            <input
              className="input-field mt-1.5"
              value={vehicleForm.model}
              onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
            />
          </label>
          <label className="label-field">
            Client
            <input
              className="input-field mt-1.5"
              value={vehicleForm.client_name}
              onChange={(e) =>
                setVehicleForm({ ...vehicleForm, client_name: e.target.value })
              }
            />
          </label>
          <label className="label-field">
            Provenance
            <input
              className="input-field mt-1.5"
              value={vehicleForm.provenance}
              onChange={(e) =>
                setVehicleForm({ ...vehicleForm, provenance: e.target.value })
              }
            />
          </label>
        </div>
        <label className="label-field">
          Notes secrétariat
          <textarea
            className="input-field mt-1.5 resize-y"
            rows={2}
            value={vehicleForm.notes}
            onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
          />
        </label>
        <label className="checkbox-field px-2">
          <input
            type="checkbox"
            checked={vehicleForm.vei_procedure}
            onChange={(e) =>
              setVehicleForm({ ...vehicleForm, vei_procedure: e.target.checked })
            }
          />
          Procédure VEI
        </label>
      </div>

      <div className="card-padded mb-6 space-y-5">
        <h2 className="section-title">Réception atelier</h2>

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
              Ajoutez encore {4 - photoCount} photo(s).
            </p>
          )}
        </div>

        {photos.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Photos enregistrées</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={p.url}
                      alt="Photo réception"
                      className="aspect-square rounded-lg border border-slate-200 object-cover"
                    />
                  </a>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {p.photo_type === "exterior" ? "Ext." : p.photo_type}
                  </span>
                  <button
                    type="button"
                    disabled={deletingPhotoId === p.id}
                    onClick={() => removePhoto(p.id)}
                    className="absolute right-1 top-1 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingPhotoId === p.id ? "…" : "Suppr."}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <PhotoUpload
          bucket="vehicle-photos"
          pathPrefix={id}
          onUploaded={(paths) => savePhotos(paths, "exterior")}
          label="Ajouter photos extérieures"
        />

        <PhotoUpload
          bucket="vehicle-photos"
          pathPrefix={`${id}/extra`}
          onUploaded={(paths) => savePhotos(paths, "additional")}
          label="Photos supplémentaires (optionnel)"
        />

        {receptionFeedback && <Alert variant="success">{receptionFeedback}</Alert>}

        <button
          type="button"
          onClick={saveAll}
          disabled={savingReception}
          className="btn-primary-block"
        >
          {savingReception ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>

      {awaitingAssign && (
        <div className="card-padded mb-6 space-y-4">
          <h2 className="section-title">Assigner à un mécanicien</h2>
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

      {veiRequired && canSendToWorkshop && isArrived && (
        <div className="card-padded mb-6">
          <button type="button" onClick={sendToWorkshop} className="btn-primary-block">
            Envoyer à l&apos;atelier → Assigner
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {veiRequired && (
          <Link href={`/workshop/vei/${id}`} className="btn-secondary">
            Expertises VEI
          </Link>
        )}
        <Link href={`/vehicles/${id}`} className="btn-ghost">
          Fiche véhicule complète
        </Link>
      </div>
    </AppShell>
  );
}
