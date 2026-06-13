"use client";

import { useSession } from "@/lib/session-context";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { FollowupRepairPanel } from "@/components/FollowupRepairPanel";
import { LoadingPage } from "@/components/LoadingPage";
import {
  AddFollowupIssueForm,
  ReportedIssuesPanel,
} from "@/components/ReportedIssuesPanel";
import { MECHANIC_NAV } from "@/lib/role-nav";
import {
  completeIssueRepair,
  loadVehicleIssuesWithRepair,
  startIssueRepair,
  type IssueWithPart,
} from "@/lib/followup-repair";
import { createFollowupIssue } from "@/lib/mechanic-issues";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function FollowupVehiclePage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [issues, setIssues] = useState<IssueWithPart[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [repairBusyId, setRepairBusyId] = useState<string | null>(null);
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
    }
    setLoading(false);
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
    } catch {
      setError("Impossible de clôturer la réparation.");
    } finally {
      setRepairBusyId(null);
    }
  }

  if (!user || loading) return <LoadingPage />;
  if (!vehicle) return <LoadingPage />;

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
          {vehicle.make} {vehicle.model} — signalements et réparations complémentaires
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
        />
      </section>

      <section className="mb-8">
        <h2 className="section-title mb-4">Historique des signalements</h2>
        <ReportedIssuesPanel issues={issues} />
      </section>

      <AddFollowupIssueForm
        photoPrefix={`${vehicleId}/followup`}
        onSubmit={handleAddIssue}
        submitting={submitting}
      />
    </AppShell>
  );
}
