"use client";

import { useSession } from "@/lib/session-context";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { FollowupRepairPanel } from "@/components/FollowupRepairPanel";
import { LoadingPage } from "@/components/LoadingPage";
import { PartsReceiptPanel } from "@/components/PartsReceiptPanel";
import {
  AddFollowupIssueForm,
  ReportedIssuesPanel,
} from "@/components/ReportedIssuesPanel";
import { MECHANIC_NAV } from "@/lib/role-nav";
import {
  completeIssueRepair,
  loadVehicleIssuesWithRepair,
  startIssueRepair,
  type IssuePartInfo,
  type IssueWithPart,
} from "@/lib/followup-repair";
import {
  assessVehicleRepairCompletion,
  completeVehicleReconditioning,
} from "@/lib/vehicle-repair-complete";
import {
  createFollowupIssue,
} from "@/lib/mechanic-issues";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function FollowupVehiclePage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [issues, setIssues] = useState<IssueWithPart[]>([]);
  const [parts, setParts] = useState<IssuePartInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [repairBusyId, setRepairBusyId] = useState<string | null>(null);
  const [finishBusy, setFinishBusy] = useState(false);
  const [canFinishVehicle, setCanFinishVehicle] = useState(false);
  const [finishBlockers, setFinishBlockers] = useState<string[]>([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: v } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .single();
    setVehicle(v as Vehicle);
    if (user) {
      setIssues(await loadVehicleIssuesWithRepair(vehicleId, user.id));
      const { data: partRows } = await supabase
        .from("parts")
        .select("id, part_name, status, quantity, supplier, unit_price")
        .eq("vehicle_id", vehicleId);
      setParts(
        (partRows ?? []).map((p) => ({
          id: p.id,
          part_name: p.part_name,
          status: p.status,
          quantity: Number(p.quantity),
          supplier: p.supplier ?? null,
          unit_price: p.unit_price != null ? Number(p.unit_price) : null,
        }))
      );
    }
    setLoading(false);
    if (v) {
      const assessment = await assessVehicleRepairCompletion(vehicleId);
      setCanFinishVehicle(assessment.canComplete);
      setFinishBlockers(assessment.blockers);
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user, vehicleId]);

  useEffect(() => {
    const ch = supabase
      .channel(`followup-${vehicleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_reported_issues" },
        () => load()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, () =>
        load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [vehicleId, user]);

  async function handleAddIssue(data: {
    problem: string;
    partsNeeded: string;
    photoPaths: string[];
    problemCategory: import("@/lib/constants").IssueCategory;
  }) {
    if (!user) return;
    setSubmitting(true);
    setSuccess("");
    setError("");
    try {
      await createFollowupIssue(vehicleId, user.id, {
        problem: data.problem,
        partsNeeded: data.partsNeeded,
        photoPaths: data.photoPaths,
        problemCategory: data.problemCategory,
      });
      setSuccess("Signalement envoyé au chef d'atelier pour validation.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStart(issue: IssueWithPart) {
    if (!user) return;
    setRepairBusyId(issue.id);
    setError("");
    setSuccess("");
    try {
      await startIssueRepair(issue.id, user);
      setSuccess("Réparation démarrée — l'administration est notifiée.");
      await load();
    } catch {
      setError("Impossible de démarrer la réparation.");
    } finally {
      setRepairBusyId(null);
    }
  }

  async function handleComplete(issue: IssueWithPart) {
    if (!user) return;
    setRepairBusyId(issue.id);
    setError("");
    setSuccess("");
    try {
      await completeIssueRepair(issue.id, user);
      setSuccess("Réparation terminée — l'administration est notifiée.");
      await load();
      const autoDone = await assessVehicleRepairCompletion(vehicleId);
      if (autoDone.canComplete) {
        setSuccess(
          "Toutes les réparations sont terminées. Confirmez « Reconditionnement terminé » ci-dessous pour envoyer au chef d'atelier."
        );
      }
    } catch {
      setError("Impossible de clôturer la réparation.");
    } finally {
      setRepairBusyId(null);
    }
  }

  async function handleFinishReconditioning() {
    if (!user) return;
    setFinishBusy(true);
    setError("");
    setSuccess("");
    try {
      await completeVehicleReconditioning(vehicleId, user);
      setSuccess("Reconditionnement terminé — le chef d'atelier va valider pour la vente.");
      router.push("/vehicles/my");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de terminer le reconditionnement."
      );
    } finally {
      setFinishBusy(false);
    }
  }

  if (!user || loading) return <LoadingPage />;
  if (!vehicle) return <LoadingPage />;

  const allPartsReceived =
    parts.length > 0 &&
    parts.every(
      (p) =>
        p &&
        (p.status === "received" ||
          p.status === "in_stock" ||
          p.status === "ready_for_mechanic")
    );

  return (
    <AppShell
      user={user}
      nav={[
        ...MECHANIC_NAV,
        { href: `/vehicles/followup/${vehicleId}`, label: vehicle.license_plate },
      ]}
    >
      <div className="mb-6">
        <Link
          href="/vehicles/followup"
          className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800"
        >
          ← Recherche immatriculation
        </Link>
        <h1 className="page-title">{vehicle.license_plate}</h1>
        <p className="page-subtitle">
          {vehicle.make} {vehicle.model} — réception pièces, réparations et signalements
          oubliés
        </p>
      </div>

      {success && (
        <Alert variant="success" className="mb-6">
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      <section className="mb-8">
        <PartsReceiptPanel parts={parts} allReceived={allPartsReceived} />
      </section>

      <section className="mb-8">
        <h2 className="section-title mb-2">Réparations (pièces reçues)</h2>
        <p className="mb-4 text-sm text-slate-500">
          Une fois les pièces reçues, démarrez la réparation manuelle puis indiquez quand
          vous avez terminé.
        </p>
        <FollowupRepairPanel
          issues={issues}
          onStart={handleStart}
          onComplete={handleComplete}
          busyId={repairBusyId}
          showTaskTiming={user.role === "admin"}
        />
      </section>

      {(canFinishVehicle ||
        finishBlockers.length > 0 ||
        vehicle.status === "repair_in_progress" ||
        vehicle.status === "validation_pending") && (
        <section className="mb-8">
          <h2 className="section-title mb-2">Fin du reconditionnement</h2>
          <p className="mb-4 text-sm text-slate-500">
            Une fois toutes les réparations et pièces terminées, confirmez l&apos;envoi au
            chef d&apos;atelier pour validation finale et mise en vente.
          </p>
          {finishBlockers.length > 0 && (
            <ul className="mb-4 list-inside list-disc text-sm text-amber-800">
              {finishBlockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleFinishReconditioning}
            disabled={!canFinishVehicle || finishBusy}
            className="btn-success w-full !min-h-12 disabled:opacity-50"
          >
            {finishBusy ? "Envoi…" : "Reconditionnement terminé"}
          </button>
        </section>
      )}

      <section className="mb-8">
        <h2 className="section-title mb-4">Historique des signalements</h2>
        <ReportedIssuesPanel issues={issues} />
      </section>

      <AddFollowupIssueForm
        photoPrefix={`${vehicleId}/followup`}
        onSubmit={handleAddIssue}
        submitting={submitting}
      />
      <p className="mt-2 text-xs text-slate-500">
        Un signalement oublié est envoyé au chef d&apos;atelier pour validation, puis
        commandé par le magasinier.
      </p>
    </AppShell>
  );
}
