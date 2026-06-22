"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { MANAGER_NAV } from "@/lib/manager";
import {
  fetchVehiclesReadyForScheduling,
  scheduleVehicleRepair,
  type VehicleScheduleRow,
} from "@/lib/repair-scheduling";
import { supabase } from "@/lib/supabase";
import type { User } from "@/lib/types";
import { useSession } from "@/lib/session-context";

export default function RepairSchedulePage() {
  const user = useSession();
  const [rows, setRows] = useState<VehicleScheduleRow[]>([]);
  const [mechanics, setMechanics] = useState<User[]>([]);
  const [selected, setSelected] = useState<VehicleScheduleRow | null>(null);
  const [mechanicId, setMechanicId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    const [list, mechRes] = await Promise.all([
      fetchVehiclesReadyForScheduling(),
      supabase
        .from("users")
        .select("id, full_name, username, role, mechanic_slot, active, created_at")
        .eq("role", "mechanic")
        .eq("active", true)
        .order("mechanic_slot"),
    ]);
    setRows(list);
    setMechanics((mechRes.data as User[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("repair-schedule")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function handleSchedule() {
    if (!user || !selected || !mechanicId || !scheduledAt) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await scheduleVehicleRepair(selected.id, mechanicId, scheduledAt, user);
      setSuccess(`Réparation planifiée pour ${selected.license_plate}.`);
      setSelected(null);
      setMechanicId("");
      setScheduledAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planification impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Planification réparations"
        subtitle="Véhicules dont toutes les pièces sont prêtes pour le mécanicien"
      />

      {success && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</p>
      )}

      {loading ? (
        <div className="skeleton h-24 rounded-xl" />
      ) : !selected ? (
        rows.length === 0 ? (
          <EmptyState
            title="Aucun véhicule à planifier"
            description="Vous serez notifié quand le magasinier aura marqué toutes les pièces prêtes."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelected(row);
                  setMechanicId(row.assigned_mechanic_id ?? "");
                  setError("");
                }}
                className="card-interactive w-full text-left"
              >
                <p className="font-semibold">{row.license_plate}</p>
                <p className="text-sm text-slate-600">
                  {row.make} {row.model}
                  {row.mechanic?.full_name && ` · ${row.mechanic.full_name}`}
                </p>
                <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                  Pièces prêtes mécanicien
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="card-padded space-y-4">
          <button type="button" onClick={() => setSelected(null)} className="btn-secondary">
            ← Retour
          </button>
          <h2 className="text-lg font-semibold">{selected.license_plate}</h2>
          <label className="label-field">
            Mécanicien
            <select
              className="input-field mt-1.5"
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
            >
              <option value="">Choisir…</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                  {m.mechanic_slot != null ? ` (poste ${m.mechanic_slot})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="label-field">
            Date et heure de réparation
            <input
              type="datetime-local"
              className="input-field mt-1.5"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={busy || !mechanicId || !scheduledAt}
            onClick={handleSchedule}
            className="btn-primary-block"
          >
            {busy ? "Planification…" : "Planifier et notifier le mécanicien"}
          </button>
        </div>
      )}
    </AppShell>
  );
}
