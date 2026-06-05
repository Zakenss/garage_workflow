"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VehicleCard } from "@/components/VehicleCard";
import { supabase } from "@/lib/supabase";
import {
  addTimeline,
  notifyUser,
  updateVehicleStatus,
} from "@/lib/db";
import type { SessionUser, User, Vehicle } from "@/lib/types";

export default function AssignPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<User[]>([]);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data: v } = await supabase
      .from("vehicles")
      .select("*")
      .in("status", ["in_workshop", "diagnostic_complete"])
      .order("updated_at");
    setVehicles((v as Vehicle[]) ?? []);
    const { data: m } = await supabase
      .from("users")
      .select("id, full_name, username, role, mechanic_slot, active, created_at")
      .eq("role", "mechanic")
      .eq("active", true)
      .order("mechanic_slot");
    setMechanics((m as User[]) ?? []);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("assignments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_assignments" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function assign(vehicleId: string, mechanicId: string) {
    if (!user) return;
    await supabase.from("mechanic_assignments").insert({
      vehicle_id: vehicleId,
      mechanic_id: mechanicId,
      assigned_by: user.id,
    });
    await supabase
      .from("vehicles")
      .update({ assigned_mechanic_id: mechanicId })
      .eq("id", vehicleId);
    await updateVehicleStatus(vehicleId, "diagnostic_assigned", user);
    await notifyUser(
      mechanicId,
      "diagnostic_assigned",
      "Nouveau véhicule assigné pour diagnostic",
      vehicleId
    );
    await addTimeline(vehicleId, user.id, "mechanic_assigned", { mechanicId });
    load();
  }

  if (!user) return <p className="p-6">Chargement…</p>;

  const pending = vehicles.filter((v) => v.status === "in_workshop");

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/workshop/assign", label: "Dispatch" },
      ]}
    >
      <h1 className="mb-6 text-2xl font-bold">Dispatch atelier</h1>
      <p className="mb-4 text-sm text-slate-600">Assigner aux mécaniciens 1, 2 ou 3</p>

      <div className="space-y-4">
        {pending.map((v) => (
          <div key={v.id} className="rounded-xl border bg-white p-4">
            <VehicleCard vehicle={v} href={`/vehicles/${v.id}`} />
            <div className="mt-3 flex flex-wrap gap-2">
              {mechanics.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => assign(v.id, m.id)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                >
                  {m.full_name} (M{m.mechanic_slot})
                </button>
              ))}
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <p className="text-slate-500">Aucun véhicule en attente d&apos;assignation.</p>
        )}
      </div>
    </AppShell>
  );
}
