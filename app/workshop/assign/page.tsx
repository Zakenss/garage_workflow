"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MANAGER_NAV } from "@/lib/manager";
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
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data: v } = await supabase
      .from("vehicles")
      .select("*")
      .eq("status", "in_workshop")
      .order("updated_at");
    setVehicles((v as Vehicle[]) ?? []);
    const { data: m } = await supabase
      .from("users")
      .select("id, full_name, username, role, mechanic_slot, active, created_at")
      .eq("role", "mechanic")
      .eq("active", true)
      .order("mechanic_slot");
    setMechanics((m as User[]) ?? []);
    setLoading(false);
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

  async function assign(vehicleId: string) {
    const mechanicId = selected[vehicleId];
    if (!user || !mechanicId) return;
    setAssigning(vehicleId);
    try {
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
      setSelected((prev) => {
        const next = { ...prev };
        delete next[vehicleId];
        return next;
      });
      await load();
    } finally {
      setAssigning(null);
    }
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Dispatch atelier"
        subtitle="Assigner un mécanicien à chaque véhicule en atelier"
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-36 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule en attente d'assignation"
          description="Les véhicules envoyés depuis la réception apparaîtront ici."
        />
      ) : (
        <div className="space-y-4">
          {vehicles.map((v) => (
            <div key={v.id} className="card-padded">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{v.license_plate}</p>
                  <p className="text-sm text-slate-600">
                    {v.make} {v.model}
                  </p>
                </div>
                <StatusBadge status={v.status} />
              </div>

              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-medium text-slate-700">
                  Sélectionner un mécanicien
                </legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {mechanics.map((m) => (
                    <label
                      key={m.id}
                      className={`checkbox-field flex-1 rounded-lg border px-3 ${
                        selected[v.id] === m.id
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`mechanic-${v.id}`}
                        value={m.id}
                        checked={selected[v.id] === m.id}
                        onChange={() =>
                          setSelected((prev) => ({ ...prev, [v.id]: m.id }))
                        }
                      />
                      Mécanicien {m.mechanic_slot ?? "?"}
                      <span className="text-xs text-slate-500">({m.full_name})</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={() => assign(v.id)}
                disabled={!selected[v.id] || assigning === v.id}
                className="btn-primary-block mt-4"
              >
                {assigning === v.id ? "Assignation…" : "Assigner"}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
