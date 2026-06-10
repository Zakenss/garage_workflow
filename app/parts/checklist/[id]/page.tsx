"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { ReconditioningChecklist } from "@/components/ReconditioningChecklist";
import { VehicleMechanicWorkCard } from "@/components/MechanicWorkPanel";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import { fetchVehicleMechanicWork } from "@/lib/mechanic-work";
import {
  createDefaultStorekeeperChecklist,
  parseStorekeeperChecklistState,
  type ChecklistState,
} from "@/lib/storekeeper-checklist";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function StorekeeperChecklistPage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState>(
    createDefaultStorekeeperChecklist()
  );
  const [mechanicWork, setMechanicWork] = useState<Awaited<
    ReturnType<typeof fetchVehicleMechanicWork>
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checklistRef = useRef(checklist);
  checklistRef.current = checklist;

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function loadChecklistRecord() {
    const { data } = await supabase
      .from("storekeeper_checklists")
      .select("id, checklist_data")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (data) {
      setChecklist(parseStorekeeperChecklistState(data.checklist_data));
      return data.id as string;
    }

    const { data: created, error } = await supabase
      .from("storekeeper_checklists")
      .insert({
        vehicle_id: vehicleId,
        checklist_data: createDefaultStorekeeperChecklist(),
        updated_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) {
      setChecklist(createDefaultStorekeeperChecklist());
      return null;
    }
    return created!.id as string;
  }

  useEffect(() => {
    async function init() {
      const { data: v } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .single();
      setVehicle(v as Vehicle);
      setMechanicWork(await fetchVehicleMechanicWork(vehicleId));
      if (user) await loadChecklistRecord();
    }
    if (user) init();
  }, [user, vehicleId]);

  const persistChecklist = useCallback(
    async (state: ChecklistState) => {
      if (!user) return;
      setSaving(true);
      const { error } = await supabase.from("storekeeper_checklists").upsert(
        {
          vehicle_id: vehicleId,
          checklist_data: state,
          updated_by: user.id,
        },
        { onConflict: "vehicle_id" }
      );
      setSaving(false);
      if (!error) setSavedAt(new Date());
    },
    [user, vehicleId]
  );

  function handleChecklistChange(next: ChecklistState) {
    setChecklist(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistChecklist(next), 800);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!user || !vehicle) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[
        ...STOREKEEPER_NAV,
        { href: `/parts/checklist/${vehicleId}`, label: vehicle.license_plate },
      ]}
    >
      <div className="mb-6">
        <Link
          href="/parts/checklist"
          className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800"
        >
          ← Retour à la liste
        </Link>
        <h1 className="page-title">
          Check-list magasinier — {vehicle.license_plate}
        </h1>
        <p className="page-subtitle">
          Analyse du rapport mécanicien · {vehicle.make} {vehicle.model}
          {saving && " · Enregistrement…"}
          {!saving && savedAt && (
            <> · Sauvegardé à {savedAt.toLocaleTimeString("fr-FR")}</>
          )}
        </p>
      </div>

      {mechanicWork &&
        (mechanicWork.parts.length > 0 || mechanicWork.photoUrls.length > 0) && (
          <section className="mb-6">
            <h2 className="section-title mb-3">Rapport mécanicien (référence)</h2>
            <VehicleMechanicWorkCard
              licensePlate={vehicle.license_plate}
              make={vehicle.make}
              model={vehicle.model}
              status={vehicle.status}
              parts={mechanicWork.parts}
              photoUrls={mechanicWork.photoUrls}
              defaultOpen
            />
          </section>
        )}

      <ReconditioningChecklist state={checklist} onChange={handleChecklistChange} />
    </AppShell>
  );
}
