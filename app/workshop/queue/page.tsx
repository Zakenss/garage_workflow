"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { MechanicQueueEditor } from "@/components/MechanicQueueEditor";
import { PageHeader } from "@/components/PageHeader";
import { MECHANIC_SLOTS, saveMechanicQueueOrder } from "@/lib/manager-actions";
import { MANAGER_NAV } from "@/lib/manager";
import { supabase } from "@/lib/supabase";
import { fetchAssignedVehicles, type VehicleWithMechanic } from "@/lib/workshop-vehicles";
import type { SessionUser, User } from "@/lib/types";

export default function MechanicQueuePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [assigned, setAssigned] = useState<VehicleWithMechanic[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const [assignedList, mechanicsRes] = await Promise.all([
      fetchAssignedVehicles(),
      supabase
        .from("users")
        .select("id, full_name, username, role, mechanic_slot, active, created_at")
        .eq("role", "mechanic")
        .eq("active", true)
        .order("mechanic_slot"),
    ]);
    setAssigned(assignedList);
    setMechanics((mechanicsRes.data as User[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("mechanic-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const selectedMechanic = mechanics.find((m) => m.mechanic_slot === selectedSlot);
  const mechanicVehicles = assigned
    .filter((v) => v.assigned_mechanic_id === selectedMechanic?.id)
    .sort((a, b) => {
      const pa = a.dispatch_priority ?? 9999;
      const pb = b.dispatch_priority ?? 9999;
      return pa - pb;
    });

  async function handleSaveOrder(orderedIds: string[]) {
    setSaving(true);
    try {
      await saveMechanicQueueOrder(orderedIds);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Priorités mécaniciens"
        subtitle="Sélectionnez un mécanicien et glissez les véhicules pour définir l'ordre de travail"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {MECHANIC_SLOTS.map((slot) => {
          const mech = mechanics.find((m) => m.mechanic_slot === slot);
          const count = assigned.filter((v) => v.assigned_mechanic_id === mech?.id).length;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={
                selectedSlot === slot ? "btn-chip-active" : "btn-chip-inactive"
              }
            >
              Mécan. {slot}
              {count > 0 && ` (${count})`}
            </button>
          );
        })}
      </div>

      {selectedMechanic && (
        <p className="mb-4 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{selectedMechanic.full_name}</span>
          {" — "}
          {mechanicVehicles.length} véhicule(s) assigné(s)
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : !selectedMechanic ? (
        <EmptyState title={`Mécanicien ${selectedSlot} non configuré`} />
      ) : (
        <MechanicQueueEditor
          vehicles={mechanicVehicles}
          onSaveOrder={handleSaveOrder}
          saving={saving}
        />
      )}
    </AppShell>
  );
}
