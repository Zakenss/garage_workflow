"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PART_STATUS_LABELS } from "@/lib/constants";
import { MANAGER_NAV } from "@/lib/manager";
import { formatEuro } from "@/lib/parts-costs";
import { supabase } from "@/lib/supabase";
import type { SessionUser } from "@/lib/types";
import {
  REPAIR_STATE_LABELS,
  fetchWorkshopSupervision,
  formatDuration,
  formatRepairDate,
  type SupervisionVehicle,
} from "@/lib/workshop-supervision";

const ADMIN_NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/dashboard/supervision", label: "Supervision atelier" },
  { href: "/parts/costs", label: "Coûts pièces" },
  { href: "/users", label: "Utilisateurs" },
];

export default function SupervisionPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<SupervisionVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    setRows(await fetchWorkshopSupervision());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("supervision")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_reported_issues" },
        () => load()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, () =>
        load()
      )
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

  if (!user) return <LoadingPage />;

  if (user.role !== "admin" && user.role !== "workshop_manager") {
    return (
      <AppShell user={user} nav={[]}>
        <EmptyState title="Accès réservé à l'administration" />
      </AppShell>
    );
  }

  const nav =
    user.role === "admin"
      ? ADMIN_NAV
      : [...MANAGER_NAV, { href: "/dashboard/supervision", label: "Supervision" }];

  const activeCount = rows.reduce((n, r) => n + r.activeRepairs, 0);

  return (
    <AppShell user={user} nav={nav}>
      <PageHeader
        title="Supervision atelier"
        subtitle="Vue complète : véhicules, problèmes, pièces, horaires de réparation"
      />

      {!loading && rows.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="card-padded border-slate-200 bg-white">
            <p className="text-2xl font-bold">{rows.length}</p>
            <p className="text-sm text-slate-600">Véhicules suivis</p>
          </div>
          <div className="card-padded border-amber-200 bg-amber-50/80">
            <p className="text-2xl font-bold text-amber-950">{activeCount}</p>
            <p className="text-sm text-amber-900">Réparations en cours</p>
          </div>
          <div className="card-padded border-emerald-200 bg-emerald-50/80">
            <p className="text-2xl font-bold text-emerald-950">
              {formatEuro(rows.reduce((s, r) => s + r.totalPartsCost, 0))}
            </p>
            <p className="text-sm text-emerald-800">Coût pièces (tarifées)</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune activité"
          description="Les signalements mécaniciens et pièces apparaîtront ici."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <details key={row.vehicle.id} className="card-padded group" open={row.activeRepairs > 0}>
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-slate-900">
                        {row.vehicle.license_plate}
                      </p>
                      <StatusBadge status={row.vehicle.status} />
                      {row.activeRepairs > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          {row.activeRepairs} en cours
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {row.vehicle.make} {row.vehicle.model}
                      {row.mechanicName && ` · Mécanicien : ${row.mechanicName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      {formatEuro(row.totalPartsCost)}
                    </p>
                    <p className="text-xs text-slate-500">coût pièces</p>
                  </div>
                </div>
              </summary>

              <div className="mt-4 space-y-6 border-t border-slate-100 pt-4">
                {(row.vehicle.repair_started_at || row.vehicle.repair_completed_at) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-500">Réparation véhicule — début : </span>
                      {formatRepairDate(row.vehicle.repair_started_at)}
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-500">Réparation véhicule — fin : </span>
                      {formatRepairDate(row.vehicle.repair_completed_at)}
                    </div>
                  </div>
                )}

                {row.issues.length > 0 && (
                  <section>
                    <h3 className="section-title mb-3">Problèmes & réparations</h3>
                    <div className="space-y-3">
                      {row.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <div>
                              <p className="font-medium text-slate-900">
                                {issue.checklist_label ?? "Signalement"}
                              </p>
                              <p className="mt-1 text-sm text-slate-800">{issue.problem}</p>
                              <p className="text-sm text-slate-600">
                                Pièces : {issue.parts_needed}
                              </p>
                              {issue.mechanic && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Signalé par {issue.mechanic.full_name}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 self-start rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                              {REPAIR_STATE_LABELS[issue.repairState]}
                            </span>
                          </div>

                          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                            <div>
                              <span className="text-slate-500">Début tâche</span>
                              <p className="font-medium">
                                {formatRepairDate(issue.repair_started_at)}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500">Fin tâche</span>
                              <p className="font-medium">
                                {formatRepairDate(issue.repair_completed_at)}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500">Durée</span>
                              <p className="font-medium">
                                {formatDuration(issue.durationMinutes)}
                              </p>
                            </div>
                          </div>

                          {issue.photoUrls.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {issue.photoUrls.map((src) => (
                                <a
                                  key={src}
                                  href={src}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={src}
                                    alt="Photo"
                                    className="h-16 w-16 rounded border object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {row.parts.length > 0 && (
                  <section>
                    <h3 className="section-title mb-3">Pièces</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                            <th className="pb-2 pr-2">Pièce</th>
                            <th className="pb-2 pr-2">Statut</th>
                            <th className="pb-2 pr-2">Fournisseur</th>
                            <th className="pb-2 pr-2">P.U.</th>
                            <th className="pb-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.parts.map((p) => (
                            <tr key={p.id} className="border-b border-slate-50">
                              <td className="py-2 pr-2">{p.part_name}</td>
                              <td className="py-2 pr-2 text-slate-600">
                                {PART_STATUS_LABELS[p.status] ?? p.status}
                              </td>
                              <td className="py-2 pr-2 text-slate-600">
                                {p.supplier ?? "—"}
                              </td>
                              <td className="py-2 pr-2">
                                {p.unit_price != null ? formatEuro(p.unit_price) : "—"}
                              </td>
                              <td className="py-2 text-right font-medium">
                                {p.lineTotal > 0 ? formatEuro(p.lineTotal) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <Link
                  href={`/vehicles/${row.vehicle.id}`}
                  className="inline-block text-sm text-slate-600 hover:text-slate-900"
                >
                  Fiche véhicule →
                </Link>
              </div>
            </details>
          ))}
        </div>
      )}
    </AppShell>
  );
}
