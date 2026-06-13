"use client";

import { useSession } from "@/lib/session-context";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ReconditioningChecklist } from "@/components/ReconditioningChecklist";
import { SignaturePad } from "@/components/SignaturePad";
import { supabase } from "@/lib/supabase";
import { notifyRole, updateVehicleStatus } from "@/lib/db";
import {
  createDefaultChecklist,
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"diagnostic" | "repair" | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checklistRef = useRef(checklist);
  checklistRef.current = checklist;

  async function ensureDiagnostic(mechanicId: string) {
    const { data: existing } = await supabase
      .from("diagnostics")
      .select("id, checklist_data, signature_data, status")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setDiagnosticId(existing.id);
      setChecklist(parseChecklistState(existing.checklist_data));
      if (existing.signature_data) setSignature(existing.signature_data);
      if (existing.checklist_data) {
        const parsed = parseChecklistState(existing.checklist_data);
        await syncChecklistPartsToDb(vehicleId, existing.id, parsed);
        await syncChecklistToReportedIssues(vehicleId, mechanicId, parsed);
      }
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
      if (!err) {
        await syncChecklistPartsToDb(vehicleId, diagnosticId, state);
        const { data: diag } = await supabase
          .from("diagnostics")
          .select("mechanic_id")
          .eq("id", diagnosticId)
          .single();
        if (diag?.mechanic_id) {
          await syncChecklistToReportedIssues(vehicleId, diag.mechanic_id, state);
        }
        setSavedAt(new Date());
      }
      setSaving(false);
    },
    [diagnosticId, vehicleId]
  );

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

  async function completeDiagnostic() {
    if (!user || !diagnosticId || !vehicle) return;
    setError("");
    if (!signature) {
      setError("Signature requise avant de terminer le diagnostic.");
      return;
    }

    await persistChecklist(checklistRef.current);
    await syncChecklistPartsToDb(vehicleId, diagnosticId, checklistRef.current);

    await supabase
      .from("diagnostics")
      .update({
        checklist_data: checklistRef.current,
        signature_data: signature,
        signed_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", diagnosticId);

    await updateVehicleStatus(vehicleId, "diagnostic_complete", user, {
      diagnostic_completed_at: new Date().toISOString(),
    });
    await supabase.from("vehicles").update({ status: "parts_pending" }).eq("id", vehicleId);

    await notifyRole(
      "workshop_manager",
      "diagnostic_complete",
      `Check-list terminée — ${vehicle.license_plate}`,
      vehicleId
    );
    await notifyRole(
      "storekeeper",
      "diagnostic_complete",
      `Check-list terminée — ${vehicle.license_plate}`,
      vehicleId
    );

    router.push("/vehicles/my");
  }

  async function completeRepair() {
    if (!user || !vehicle) return;
    setError("");
    await persistChecklist(checklistRef.current);

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
  }

  if (!user || !vehicle) return <LoadingPage />;

  const isRepairPhase = vehicle.status === "repair_in_progress";
  const canCompleteDiagnostic = vehicle.status === "diagnostic_assigned";

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
        </p>
      </div>

      <ReconditioningChecklist
        state={checklist}
        onChange={handleChecklistChange}
        enableIssues
        issuePhotoPrefix={`${vehicleId}/${diagnosticId ?? "new"}`}
      />

      <div className="card-padded mt-6 space-y-5">
        <PhotoUpload
          bucket="diagnostic-photos"
          pathPrefix={`${vehicleId}/${diagnosticId ?? "new"}`}
          onUploaded={saveDiagnosticPhotos}
          label="Photos pièces / zones endommagées"
        />

        {canCompleteDiagnostic && (
          <>
            <div>
              <h2 className="section-title mb-3">Signature électronique</h2>
              <SignaturePad onSave={setSignature} />
              {signature && (
                <Alert variant="success" className="mt-3">
                  Signature enregistrée
                </Alert>
              )}
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <button
              type="button"
              onClick={() => {
                setConfirmAction("diagnostic");
                setShowConfirm(true);
              }}
              className="btn-primary-block"
            >
              Terminer le diagnostic
            </button>
          </>
        )}

        {isRepairPhase && (
          <>
            {error && <Alert variant="error">{error}</Alert>}
            <button
              type="button"
              onClick={() => {
                setConfirmAction("repair");
                setShowConfirm(true);
              }}
              className="btn-success w-full !min-h-12"
            >
              Reconditionnement terminé
            </button>
          </>
        )}
      </div>

      {showConfirm && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="modal-panel">
            <p id="confirm-title" className="font-medium leading-relaxed text-slate-900">
              {confirmAction === "repair"
                ? "Confirmez-vous que le reconditionnement est complet ?"
                : "Confirmez-vous que la check-list diagnostic est complète ?"}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmAction(null);
                }}
                className="btn-secondary flex-1"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  if (confirmAction === "repair") completeRepair();
                  else completeDiagnostic();
                  setConfirmAction(null);
                }}
                className="btn-primary-block flex-1"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
