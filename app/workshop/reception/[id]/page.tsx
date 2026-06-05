"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PhotoUpload } from "@/components/PhotoUpload";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import { VEI_STATUS_LABELS } from "@/lib/constants";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function ReceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [vin, setVin] = useState("");
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

  async function savePhotos(paths: string[]) {
    if (!user) return;
    await supabase.from("vehicle_photos").insert(
      paths.map((p) => ({
        vehicle_id: id,
        storage_path: p,
        photo_type: "exterior",
        uploaded_by: user.id,
      }))
    );
    await load();
  }

  async function saveVei() {
    if (!vei) return;
    await supabase
      .from("vei_cases")
      .update({
        expert_name: vei.expert_name,
        appointment_date: vei.appointment_date || null,
        appointment_time: vei.appointment_time || null,
        notes: vei.notes,
        status: vei.appointment_date ? "scheduled" : "to_schedule",
      })
      .eq("vehicle_id", id);
    await load();
  }

  async function sendToWorkshop() {
    if (!user || !vehicle) return;
    if (photoCount < 4) {
      alert("Minimum 4 photos extérieures requises.");
      return;
    }
    if (vehicle.vei_procedure && vei?.status !== "completed" && vei?.status !== "scheduled") {
      alert("Planifiez l'expertise VEI avant d'envoyer à l'atelier.");
      return;
    }
    await supabase
      .from("vehicles")
      .update({ vin, serial_confirmed: true, sent_to_workshop_at: new Date().toISOString() })
      .eq("id", id);
    await updateVehicleStatus(id, "in_workshop", user);
    router.push("/workshop/assign");
  }

  if (!user || !vehicle) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/workshop/reception", label: "Réception" },
        { href: `/workshop/reception/${id}`, label: vehicle.license_plate },
      ]}
    >
      <h1 className="text-2xl font-bold">
        {vehicle.license_plate} — {vehicle.make} {vehicle.model}
      </h1>

      {vehicle.vei_procedure && (
        <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            Ce véhicule nécessite une expertise VEI
          </p>
          {vei && (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                Statut : {VEI_STATUS_LABELS[vei.status] ?? vei.status}
              </p>
              <input
                placeholder="Nom de l'expert"
                className="w-full rounded border px-3 py-2 text-sm"
                value={vei.expert_name}
                onChange={(e) => setVei({ ...vei, expert_name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="rounded border px-3 py-2 text-sm"
                  value={vei.appointment_date}
                  onChange={(e) =>
                    setVei({ ...vei, appointment_date: e.target.value })
                  }
                />
                <input
                  type="time"
                  className="rounded border px-3 py-2 text-sm"
                  value={vei.appointment_time}
                  onChange={(e) =>
                    setVei({ ...vei, appointment_time: e.target.value })
                  }
                />
              </div>
              <textarea
                placeholder="Notes VEI"
                className="w-full rounded border px-3 py-2 text-sm"
                value={vei.notes}
                onChange={(e) => setVei({ ...vei, notes: e.target.value })}
              />
              <button
                type="button"
                onClick={saveVei}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white"
              >
                Enregistrer planification VEI
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4 rounded-xl border bg-white p-6">
        <label className="block text-sm font-medium">
          Numéro de série / VIN confirmé
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
          />
        </label>

        <p className="text-sm text-slate-600">
          Photos extérieures : {photoCount} / 4 minimum
        </p>
        <PhotoUpload
          bucket="vehicle-photos"
          pathPrefix={id}
          onUploaded={savePhotos}
          label="Photos extérieures"
        />

        <button
          type="button"
          onClick={sendToWorkshop}
          className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white"
        >
          Envoyer à l&apos;atelier
        </button>
      </div>
    </AppShell>
  );
}
