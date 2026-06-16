"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { MANAGER_NAV } from "@/lib/manager";
import { supabase } from "@/lib/supabase";
import { notifyRole, updateVehicleStatus } from "@/lib/db";
import type { Vehicle } from "@/lib/types";

export default function FinalValidationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState({
    mechanics_done: false,
    bodywork_done: false,
    vehicle_complete: false,
    notes: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supabase
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setVehicle(data as Vehicle));
  }, [id]);

  async function submit() {
    if (!user || !vehicle) return;
    setError("");
    if (!checklist.mechanics_done || !checklist.vehicle_complete) {
      setError("Cochez au minimum mécanique terminée et véhicule complet.");
      return;
    }
    await supabase.from("final_checklists").upsert({
      vehicle_id: id,
      ...checklist,
      validated_by: user.id,
      validated_at: new Date().toISOString(),
    });
    await supabase
      .from("vehicles")
      .update({ workshop_notes: checklist.notes })
      .eq("id", id);
    await updateVehicleStatus(id, "ready_to_sell", user, {
      ready_at: new Date().toISOString(),
    });
    await notifyRole(
      "seller",
      "ready_to_sell",
      `Véhicule prêt pour lavage et mise en vente — ${vehicle.license_plate}`,
      id
    );
    router.push("/dashboard");
  }

  async function assignBodywork() {
    const { data: bw } = await supabase
      .from("users")
      .select("id")
      .eq("role", "bodyworker")
      .eq("active", true)
      .limit(1)
      .single();
    if (!bw || !user) return;
    await supabase.from("bodywork").insert({
      vehicle_id: id,
      bodyworker_id: bw.id,
      assigned_by: user.id,
      status: "not_started",
    });
    await supabase
      .from("vehicles")
      .update({ assigned_bodyworker_id: bw.id })
      .eq("id", id);
    await updateVehicleStatus(id, "bodywork_assigned", user);
    await notifyRole(
      "bodyworker",
      "bodywork_assigned",
      `Carrosserie assignée — ${vehicle?.license_plate}`,
      id
    );
    setSuccess("Carrossier notifié.");
  }

  if (!user || !vehicle) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[
        ...MANAGER_NAV,
        { href: `/workshop/final/${id}`, label: vehicle.license_plate },
      ]}
    >
      <div className="mb-6">
        <h1 className="page-title">Validation finale — {vehicle.license_plate}</h1>
        <p className="page-subtitle">Contrôle avant passage au vendeur</p>
      </div>

      <div className="card-padded space-y-4">
        {(
          [
            ["mechanics_done", "Mécanique terminée"],
            ["bodywork_done", "Carrosserie terminée"],
            ["vehicle_complete", "Véhicule complet"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="checkbox-field px-2">
            <input
              type="checkbox"
              checked={checklist[key]}
              onChange={(e) =>
                setChecklist({ ...checklist, [key]: e.target.checked })
              }
            />
            {label}
          </label>
        ))}

        <label className="label-field">
          Notes atelier
          <textarea
            className="input-field mt-1.5 resize-y"
            placeholder="Observations finales…"
            value={checklist.notes}
            onChange={(e) => setChecklist({ ...checklist, notes: e.target.value })}
          />
        </label>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <button type="button" onClick={assignBodywork} className="btn-secondary w-full">
          Assigner carrosserie
        </button>
        <button type="button" onClick={submit} className="btn-success w-full !min-h-12">
          Prêt à vendre
        </button>
      </div>
    </AppShell>
  );
}
