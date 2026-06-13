"use client";

import { useSession } from "@/lib/session-context";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { ReconditioningChecklist } from "@/components/ReconditioningChecklist";
import { ReportedIssuesPanel } from "@/components/ReportedIssuesPanel";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import {
  fetchVehicleIssues,
  loadVehicleIssuesWithSync,
  submitStorekeeperChecklist,
  type MechanicReportedIssue,
} from "@/lib/mechanic-issues";
import {
  createDefaultStorekeeperChecklist,
  parseStorekeeperChecklistState,
  type ChecklistState,
} from "@/lib/storekeeper-checklist";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function StorekeeperChecklistPage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState>(
    createDefaultStorekeeperChecklist()
  );
  const [issues, setIssues] = useState<MechanicReportedIssue[]>([]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadChecklistRecord() {
    const { data } = await supabase
      .from("storekeeper_checklists")
      .select("id, checklist_data, submitted_at")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (data) {
      setChecklist(parseStorekeeperChecklistState(data.checklist_data));
      setSubmittedAt(data.submitted_at ?? null);
      return;
    }

    await supabase.from("storekeeper_checklists").insert({
      vehicle_id: vehicleId,
      checklist_data: createDefaultStorekeeperChecklist(),
      updated_by: user?.id ?? null,
    });
  }

  useEffect(() => {
    async function init() {
      const { data: v } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .single();
      setVehicle(v as Vehicle);
      if (user) {
        await loadChecklistRecord();
        setIssues(
          await loadVehicleIssuesWithSync(vehicleId, user.id).catch(() =>
            fetchVehicleIssues(vehicleId)
          )
        );
      }
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

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    setSubmitSuccess(false);
    await persistChecklist(checklist);
    await submitStorekeeperChecklist(vehicleId, user.id);
    setSubmittedAt(new Date().toISOString());
    setSubmitSuccess(true);
    setSubmitting(false);
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
          {vehicle.make} {vehicle.model}
          {saving && " · Enregistrement…"}
          {!saving && savedAt && (
            <> · Sauvegardé à {savedAt.toLocaleTimeString("fr-FR")}</>
          )}
          {submittedAt && (
            <> · Soumis le {new Date(submittedAt).toLocaleString("fr-FR")}</>
          )}
        </p>
      </div>

      <section className="mb-8">
        <h2 className="section-title mb-4">
          Problèmes signalés par le mécanicien (photos)
        </h2>
        <ReportedIssuesPanel issues={issues} />
      </section>

      <ReconditioningChecklist state={checklist} onChange={handleChecklistChange} />

      <div className="card-padded mt-8 space-y-4">
        {submitSuccess && (
          <Alert variant="success">
            Check-list soumise — le chef d&apos;atelier a été notifié.
          </Alert>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || Boolean(submittedAt)}
          className="btn-success w-full !min-h-12"
        >
          {submittedAt
            ? "Check-list déjà soumise"
            : submitting
              ? "Soumission…"
              : "Soumettre la check-list magasinier"}
        </button>
      </div>
    </AppShell>
  );
}
