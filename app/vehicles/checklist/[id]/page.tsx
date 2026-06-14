"use client";

import { useSession } from "@/lib/session-context";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { ChecklistSubmitSection } from "@/components/ChecklistSubmitSection";
import { LoadingPage } from "@/components/LoadingPage";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ReconditioningChecklist } from "@/components/ReconditioningChecklist";
import { supabase } from "@/lib/supabase";
import { notifyRole, updateVehicleStatus } from "@/lib/db";
import {
  createDefaultChecklist,
  getChecklistSubmitSummary,
  parseChecklistState,
  type ChecklistState,
} from "@/lib/reconditioning-checklist";
import { syncChecklistPartsToDb } from "@/lib/sync-checklist-parts";
import { syncChecklistToReportedIssues } from "@/lib/mechanic-issues";
import type { Vehicle } from "@/lib/types";

export default function ReconditioningChecklistPage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState>(createDefaultChecklist());
  const [signature, setSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"submit" | "repair" | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checklistRef = useRef(checklist);
  checklistRef.current = checklist;

  const submitSummary = useMemo(() => getChecklistSubmitSummary(checklist), [checklist]);
  const isSubmitted = Boolean(signedAt);
  const isRepairPhase = vehicle?.status === "repair_in_progress";
  const canSubmitChecklist =
    !isSubmitted &&
    (vehicle?.status === "diagnostic_assigned" || vehicle?.status === "parts_pending");

  async function ensureDiagnostic(mechanicId: string) {
    const { data: existing } = await supabase
      .from("diagnostics")
      .select("id, checklist_data, signature_data, signed_at, status")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setDiagnosticId(existing.id);
      setChecklist(parseChecklistState(existing.checklist_data));
      if (existing.signature_data) setSignature(existing.signature_data);
      if (existing.signed_at) setSignedAt(existing.signed_at);
      return existing.id;
    }

    const { data: created } = await supabase
      .from("diagnostics")
      .insert({ vehicle_id: vehicleId, mechanic_id: mechanicId })
      .select("id")
      .single();
    setDiagnosticId(created!.id);
    return created!.id;
  }

  async function loadVehicle() {
    const { data: v } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .single();
    setVehicle(v as Vehicle);
  }

  useEffect(() => {
    async function init() {
      await loadVehicle();
      if (user) await ensureDiagnostic(user.id);
    }
    if (user) init();
  }, [user, vehicleId]);

  const persistChecklist = useCallback(
    async (state: ChecklistState) => {
      if (!diagnosticId) return;
      setSaving(true);
      const { error: err } = await supabase
        .from("diagnostics")
        .update({ checklist_data: state })
        .eq("id", diagnosticId);
      if (!err) setSavedAt(new Date());
      setSaving(false);
    },
    [diagnosticId]
  );

  async function publishSignalements(state: ChecklistState) {
    if (!diagnosticId || !user) return;
    await syncChecklistPartsToDb(vehicleId, diagnosticId, state);
    await syncChecklistToReportedIssues(vehicleId, user.id, state);
  }

  function handleChecklistChange(next: ChecklistState) {
    setChecklist(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistChecklist(next);
    }, 800);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function saveDiagnosticPhotos(paths: string[]) {
    if (!diagnosticId) return;
    await supabase.from("diagnostic_photos").insert(
      paths.map((p) => ({ diagnostic_id: diagnosticId, storage_path: p }))
    );
  }

  function openSubmitConfirm() {
    setError("");
    if (!signature) {
      setError("Enregistrez votre signature avant de soumettre.");
      return;
    }
    setConfirmAction("submit");
    setShowConfirm(true);
  }

  async function submitChecklist() {
    if (!user || !diagnosticId || !vehicle || !signature) return;
    setSubmitting(true);
    setError("");
    try {
      const state = checklistRef.current;
      await persistChecklist(state);
      await publishSignalements(state);

      const now = new Date().toISOString();
      await supabase
        .from("diagnostics")
        .update({
          checklist_data: state,
          signature_data: signature,
          signed_at: now,
          status: "completed",
        })
        .eq("id", diagnosticId);

      setSignedAt(now);

      await updateVehicleStatus(vehicleId, "diagnostic_complete", user, {
        diagnostic_completed_at: now,
      });
      await supabase.from("vehicles").update({ status: "parts_pending" }).eq("id", vehicleId);

      const issueCount = getChecklistSubmitSummary(state).issues.length;
      const msg = `Check-list soumise — ${vehicle.license_plate}${
        issueCount > 0 ? ` (${issueCount} signalement${issueCount > 1 ? "s" : ""})` : ""
      }`;

      await notifyRole("workshop_manager", "diagnostic_complete", msg, vehicleId);
      await notifyRole("storekeeper", "diagnostic_complete", msg, vehicleId);
      await notifyRole("admin", "diagnostic_complete", msg, vehicleId);

      router.push("/vehicles/my");
    } catch {
      setError("Impossible de soumettre la check-list. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeRepair() {
    if (!user || !vehicle) return;
    setSubmitting(true);
    setError("");
    try {
      const state = checklistRef.current;
      await persistChecklist(state);
      await publishSignalements(state);

      const { data: existing } = await supabase
        .from("repairs")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();

      const payload = {
        vehicle_id: vehicleId,
        mechanic_id: user.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("repairs").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("repairs").insert({
          ...payload,
          started_at: new Date().toISOString(),
        });
      }

      await updateVehicleStatus(vehicleId, "repair_complete", user, {
        repair_completed_at: new Date().toISOString(),
      });
      await notifyRole(
        "workshop_manager",
        "repair_complete",
        `Reconditionnement terminé — ${vehicle.license_plate}`,
        vehicleId
      );
      router.push("/vehicles/my");
    } catch {
      setError("Impossible de terminer le reconditionnement.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user || !vehicle) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/vehicles/my", label: "Mes véhicules" },
        { href: `/vehicles/checklist/${vehicleId}`, label: "Check-list" },
      ]}
    >
      <div className="mb-6">
        <h1 className="page-title">
          Check-list reconditionnement — {vehicle.license_plate}
        </h1>
        <p className="page-subtitle">
          {vehicle.make} {vehicle.model}
          {saving && " · Enregistrement…"}
          {!saving && savedAt && (
            <> · Sauvegardé à {savedAt.toLocaleTimeString("fr-FR")}</>
          )}
          {isSubmitted && " · Soumise"}
        </p>
      </div>

      <ReconditioningChecklist
        state={checklist}
        onChange={handleChecklistChange}
        enableIssues={!isSubmitted}
        readOnly={isSubmitted && !isRepairPhase}
        issuePhotoPrefix={`${vehicleId}/${diagnosticId ?? "new"}`}
      />

      <div className="card-padded mt-6">
        <PhotoUpload
          bucket="diagnostic-photos"
          pathPrefix={`${vehicleId}/${diagnosticId ?? "new"}`}
          onUploaded={saveDiagnosticPhotos}
          label="Photos pièces / zones endommagées"
        />
      </div>

      {canSubmitChecklist && (
        <ChecklistSubmitSection
          summary={submitSummary}
          signature={signature}
          onSignature={setSignature}
          signedAt={signedAt}
          onSubmit={openSubmitConfirm}
          submitting={submitting}
          error={error}
        />
      )}

      {isSubmitted && !isRepairPhase && (
        <ChecklistSubmitSection
          summary={submitSummary}
          signature={signature}
          onSignature={setSignature}
          signedAt={signedAt}
          onSubmit={() => {}}
        />
      )}

      {isRepairPhase && (
        <div className="card-padded mt-6 space-y-4">
          <h2 className="section-title">Fin de reconditionnement</h2>
          <p className="text-sm text-slate-600">
            Vérifiez une dernière fois la check-list et les signalements avant de clôturer.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setConfirmAction("repair");
              setShowConfirm(true);
            }}
            className="btn-success w-full !min-h-12"
          >
            {submitting ? "Enregistrement…" : "Reconditionnement terminé"}
          </button>
        </div>
      )}

      {showConfirm && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="modal-panel max-h-[85vh] overflow-y-auto">
            <p id="confirm-title" className="font-medium leading-relaxed text-slate-900">
              {confirmAction === "repair"
                ? "Confirmez-vous que le reconditionnement est complet ?"
                : "Confirmez-vous la soumission de la check-list ?"}
            </p>

            {confirmAction === "submit" && (
              <div className="mt-4 space-y-3 text-sm">
                {submitSummary.unchecked.length > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <strong>{submitSummary.unchecked.length}</strong> point
                    {submitSummary.unchecked.length > 1 ? "s" : ""} non coché
                    {submitSummary.unchecked.length > 1 ? "s" : ""} — rien n&apos;oublié ?
                  </p>
                )}
                {submitSummary.issues.length > 0 ? (
                  <p className="text-slate-700">
                    <strong>{submitSummary.issues.length}</strong> signalement
                    {submitSummary.issues.length > 1 ? "s" : ""} avec photos et pièces seront
                    envoyés au chef d&apos;atelier et au magasinier.
                  </p>
                ) : (
                  <p className="text-slate-600">
                    Aucun signalement (!) — confirmez seulement si aucun problème n&apos;a été
                    détecté.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmAction(null);
                }}
                className="btn-secondary flex-1"
              >
                Retour — vérifier
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowConfirm(false);
                  if (confirmAction === "repair") completeRepair();
                  else submitChecklist();
                  setConfirmAction(null);
                }}
                className="btn-primary-block flex-1"
              >
                {submitting ? "Envoi…" : "Confirmer la soumission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
