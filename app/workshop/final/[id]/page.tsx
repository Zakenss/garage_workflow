"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { notifyRole, updateVehicleStatus } from "@/lib/db";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function FinalValidationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState({
    mechanics_done: false,
    bodywork_done: false,
    vehicle_complete: false,
    notes: "",
  });

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

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
    if (!checklist.mechanics_done || !checklist.vehicle_complete) {
      alert("Cochez au minimum mécanique terminée et véhicule complet.");
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
    alert("Carrossier notifié.");
  }

  if (!user || !vehicle) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/workshop/final", label: "Validation finale" },
        { href: `/workshop/final/${id}`, label: vehicle.license_plate },
      ]}
    >
      <h1 className="text-2xl font-bold">Validation finale — {vehicle.license_plate}</h1>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-6">
        {(
          [
            ["mechanics_done", "Mécanique terminée"],
            ["bodywork_done", "Carrosserie terminée"],
            ["vehicle_complete", "Véhicule complet"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
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
        <textarea
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Notes atelier"
          value={checklist.notes}
          onChange={(e) => setChecklist({ ...checklist, notes: e.target.value })}
        />
        <button
          type="button"
          onClick={assignBodywork}
          className="w-full rounded-lg border py-2 text-sm"
        >
          Assigner carrosserie
        </button>
        <button
          type="button"
          onClick={submit}
          className="w-full rounded-lg bg-emerald-700 py-3 text-white"
        >
          Prêt à vendre
        </button>
      </div>
    </AppShell>
  );
}
