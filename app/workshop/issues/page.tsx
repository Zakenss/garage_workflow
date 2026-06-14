"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { ReportedIssuesPanel } from "@/components/ReportedIssuesPanel";
import { MANAGER_NAV } from "@/lib/manager";
import {
  approveIssue,
  fetchPendingIssues,
  rejectIssue,
  type MechanicReportedIssue,
} from "@/lib/mechanic-issues";
import { supabase } from "@/lib/supabase";

export default function ManagerSignalementsPage() {
  const user = useSession();
  const [issues, setIssues] = useState<MechanicReportedIssue[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setIssues(await fetchPendingIssues());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("manager-signalements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_reported_issues" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function handleApprove(issue: MechanicReportedIssue) {
    if (!user || !issue.vehicle) return;
    setBusyId(issue.id);
    try {
      await approveIssue(issue.id, user.id, issue.vehicle.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(issue: MechanicReportedIssue) {
    if (!user) return;
    setBusyId(issue.id);
    try {
      await rejectIssue(issue.id, user.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Signalements"
        subtitle="Pièces oubliées signalées par le mécanicien après réception — valider pour commande magasin"
      />

      <p className="mb-6 text-sm text-slate-600">
        La check-list initiale (problèmes, photos, pièces) est consultée sur{" "}
        <a href="/parts" className="font-medium text-slate-900 underline">
          Photos et problèmes
        </a>
        . Cette page concerne uniquement les signalements complémentaires.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState title="Aucun signalement en attente de validation" />
      ) : (
        <div className="space-y-6">
          {issues.map((issue) => (
            <div key={issue.id} className="card-padded">
              {issue.vehicle && (
                <p className="mb-3 font-semibold text-slate-900">
                  {issue.vehicle.license_plate} — {issue.vehicle.make}{" "}
                  {issue.vehicle.model}
                </p>
              )}
              <ReportedIssuesPanel
                issues={[issue]}
                showActions="manager"
                busyId={busyId}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
