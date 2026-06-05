"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { notifyRole, updateVehicleStatus } from "@/lib/db";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function RepairPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [comments, setComments] = useState("");
  const [repairId, setRepairId] = useState<string | null>(null);
  const [status, setStatus] = useState("not_started");

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  useEffect(() => {
    async function load() {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).single();
      setVehicle(v as Vehicle);
      const { data: r } = await supabase
        .from("repairs")
        .select("*")
        .eq("vehicle_id", id)
        .maybeSingle();
      if (r) {
        setRepairId(r.id);
        setStatus(r.status);
        setComments(r.comments ?? "");
      }
    }
    load();
  }, [id]);

  async function startRepair() {
    if (!user) return;
    const payload = {
      vehicle_id: id,
      mechanic_id: user.id,
      status: "in_progress",
      started_at: new Date().toISOString(),
      comments,
    };
    if (repairId) {
      await supabase.from("repairs").update(payload).eq("id", repairId);
    } else {
      const { data } = await supabase.from("repairs").insert(payload).select("id").single();
      setRepairId(data!.id);
    }
    await updateVehicleStatus(id, "repair_in_progress", user, {
      repair_started_at: new Date().toISOString(),
    });
    setStatus("in_progress");
  }

  async function completeRepair() {
    if (!user || !repairId) return;
    await supabase
      .from("repairs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        comments,
      })
      .eq("id", repairId);
    await updateVehicleStatus(id, "repair_complete", user, {
      repair_completed_at: new Date().toISOString(),
    });
    await notifyRole(
      "workshop_manager",
      "repair_complete",
      `Réparation terminée — ${vehicle?.license_plate}`,
      id
    );
    router.push("/vehicles/my");
  }

  if (!user || !vehicle) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/vehicles/my", label: "Mes véhicules" },
        { href: `/vehicles/repair/${id}`, label: "Réparation" },
      ]}
    >
      <h1 className="text-2xl font-bold">Réparation — {vehicle.license_plate}</h1>
      <div className="mt-6 space-y-4 rounded-xl border bg-white p-6">
        <p className="text-sm text-slate-600">Statut : {status}</p>
        <textarea
          className="w-full rounded-lg border px-3 py-2"
          rows={4}
          placeholder="Commentaires / étapes"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
        {status === "not_started" && (
          <button
            type="button"
            onClick={startRepair}
            className="w-full rounded-lg bg-slate-900 py-3 text-white"
          >
            Commencer réparation
          </button>
        )}
        {status === "in_progress" && (
          <button
            type="button"
            onClick={completeRepair}
            className="w-full rounded-lg bg-emerald-700 py-3 text-white"
          >
            Réparation terminée
          </button>
        )}
      </div>
    </AppShell>
  );
}
