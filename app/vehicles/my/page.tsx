"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/VehicleCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PART_STATUS_LABELS } from "@/lib/constants";
import { fetchMechanicScheduledVehicles } from "@/lib/repair-scheduling";
import { MECHANIC_NAV } from "@/lib/role-nav";
import { useSession } from "@/lib/session-context";
import Link from "next/link";

function vehicleHref(status: string, id: string): string {
  if (status === "validation_pending" || status === "repair_in_progress") {
    return `/vehicles/followup/${id}`;
  }
  return `/vehicles/checklist/${id}`;
}

function vehicleSubtitle(
  status: string,
  scheduledAt: string | null,
  partsReady: boolean
): string {
  const parts = partsReady ? "Pièces prêtes au magasin · " : "";
  if (scheduledAt) {
    const when = new Date(scheduledAt).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `${parts}Planifié le ${when}`;
  }
  switch (status) {
    case "parts_pending":
      return "En attente pièces magasin";
    case "validation_pending":
      return `${parts}Réception pièces & réparations`;
    case "repair_in_progress":
      return "Réparations en cours";
    default:
      return "Check-list de reconditionnement";
  }
}

export default function MyVehiclesPage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<
    Awaited<ReturnType<typeof fetchMechanicScheduledVehicles>>
  >([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setVehicles(await fetchMechanicScheduledVehicles(user.id));
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MECHANIC_NAV]}>
      <PageHeader
        title="Mon planning"
        subtitle="Ordre de travail, planification et pièces préparées par véhicule"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule assigné"
          description="Le chef d'atelier vous assignera et planifiera les réparations."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v, index) => (
            <Link
              key={v.id}
              href={vehicleHref(v.status, v.id)}
              className="card-interactive group block"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                      {index + 1}
                    </span>
                    <p className="font-semibold text-slate-900">{v.license_plate}</p>
                    <PriorityBadge priority={v.dispatch_priority} />
                    {v.parts_ready && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                        Pièces prêtes
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {v.make} {v.model}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {vehicleSubtitle(v.status, v.scheduled_repair_at, v.parts_ready)}
                  </p>
                </div>
                <StatusBadge status={v.status as import("@/lib/types").VehicleStatus} />
              </div>

              {v.parts.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                  {v.parts.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-xs text-slate-600"
                    >
                      <span className="truncate">{p.part_name}</span>
                      <span
                        className={
                          p.status === "ready_for_mechanic"
                            ? "font-medium text-emerald-800"
                            : undefined
                        }
                      >
                        {PART_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
