"use client";

import { useSession } from "@/lib/session-context";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { canViewRepairCostReport } from "@/lib/repair-cost-report";
import { navForRole } from "@/lib/role-nav";
import { supabase } from "@/lib/supabase";
import type { Vehicle, VehicleStatus } from "@/lib/types";

type Row = Vehicle & {
  vehicle_documents?: { generated_at: string }[] | null;
};

const REPORT_STATUSES: VehicleStatus[] = [
  "repair_complete",
  "ready_to_sell",
  "for_sale",
  "reserved",
  "sold",
];

export default function RepairReportsPage() {
  const user = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("vehicles")
        .select("*, vehicle_documents(generated_at)")
        .in("status", REPORT_STATUSES)
        .not("repair_completed_at", "is", null)
        .order("repair_completed_at", { ascending: false });

      setRows((data as Row[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (!user) return <LoadingPage />;
  if (!canViewRepairCostReport(user.role)) {
    return (
      <AppShell user={user} nav={navForRole(user.role)}>
        <p className="text-slate-600">Accès non autorisé.</p>
      </AppShell>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (v) =>
          v.license_plate.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          (v.client_name?.toLowerCase().includes(q) ?? false)
      )
    : rows;

  return (
    <AppShell user={user} nav={navForRole(user.role)}>
      <PageHeader
        title="Rapports coût réparation"
        subtitle="Documents générés à la fin du reconditionnement"
      />

      <input
        type="search"
        className="input-field mb-4"
        placeholder="Rechercher immatriculation, marque, client…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun rapport"
          description="Les rapports sont créés lorsque le mécanicien termine le reconditionnement."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const doc = v.vehicle_documents?.[0];
            return (
              <Link
                key={v.id}
                href={`/vehicles/${v.id}`}
                className="card-interactive block"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{v.license_plate}</p>
                    <p className="text-sm text-slate-600">
                      {v.make} {v.model}
                      {v.client_name ? ` · ${v.client_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Réparation terminée le{" "}
                      {v.repair_completed_at
                        ? new Date(v.repair_completed_at).toLocaleDateString("fr-FR")
                        : "—"}
                      {doc?.generated_at
                        ? ` · Rapport : ${new Date(doc.generated_at).toLocaleDateString("fr-FR")}`
                        : " · Rapport non généré"}
                    </p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
