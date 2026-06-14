"use client";

import { useSession } from "@/lib/session-context";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { VeiStatusPicker } from "@/components/VeiStatusPicker";
import { VEI_STATUS_LABELS } from "@/lib/constants";
import { updateVeiStatus, type VeiStatus } from "@/lib/manager-actions";
import {
  fetchArrivedReceptionStates,
  isReceptionComplete,
  isVeiReadyForWorkshop,
} from "@/lib/manager-pipeline";
import { MANAGER_NAV } from "@/lib/manager";
import { supabase } from "@/lib/supabase";
import type { VehicleStatus } from "@/lib/types";

type VeiRow = {
  id: string;
  status: string;
  expert_name: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  notes: string | null;
  vehicles: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
    vei_procedure: boolean;
  };
  receptionComplete: boolean;
};

export default function VeiListPage() {
  const user = useSession();
  const [rows, setRows] = useState<VeiRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [receptionStates, veiRes] = await Promise.all([
      fetchArrivedReceptionStates(),
      supabase
        .from("vei_cases")
        .select(
          "id, status, expert_name, appointment_date, appointment_time, notes, vehicles(id, license_plate, make, model, status, vei_procedure)"
        )
        .order("updated_at", { ascending: false }),
    ]);

    const receptionByVehicle = new Map(
      receptionStates.map((v) => [v.id, isReceptionComplete(v, v.exteriorPhotoCount)])
    );

    let list = ((veiRes.data as unknown as Omit<VeiRow, "receptionComplete">[]) ?? []).map(
      (row) => ({
        ...row,
        receptionComplete: receptionByVehicle.get(row.vehicles.id) ?? false,
      })
    );

    if (filter === "pending") {
      list = list.filter(
        (row) =>
          row.vehicles.status === "arrived" && !isVeiReadyForWorkshop(row.status)
      );
    }

    setRows(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("vei-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vei_cases" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_photos" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [filter]);

  async function changeStatus(row: VeiRow, status: VeiStatus) {
    if (!user || row.status === status) return;
    setBusyId(row.id);
    try {
      await updateVeiStatus(row.id, status, user, row.vehicles.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Expertises VEI"
        subtitle="Étape 2 — après réception complète. Planifiez ou réalisez l'expertise avant l'assignation."
      />

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={filter === "pending" ? "btn-chip-active" : "btn-chip-inactive"}
        >
          En attente
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={filter === "all" ? "btn-chip-active" : "btn-chip-inactive"}
        >
          Tous
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={filter === "pending" ? "Aucune expertise VEI en attente" : "Aucun dossier VEI"}
          description={
            filter === "pending"
              ? "Tous les véhicules VEI en attente d'expertise par le chef d'atelier."
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card-padded space-y-4">
              {!r.receptionComplete && r.vehicles.status === "arrived" && (
                <Alert variant="info">
                  Réception incomplète —{" "}
                  <Link href={`/workshop/reception/${r.vehicles.id}`} className="font-medium underline">
                    terminer la réception d&apos;abord
                  </Link>
                  .
                </Alert>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link
                    href={`/workshop/reception/${r.vehicles.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {r.vehicles.license_plate}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {r.vehicles.make} {r.vehicles.model}
                  </p>
                  {(r.expert_name || r.appointment_date) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {r.expert_name && `Expert : ${r.expert_name}`}
                      {r.appointment_date && ` · ${r.appointment_date}`}
                      {r.appointment_time && ` ${r.appointment_time.slice(0, 5)}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                    {VEI_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <StatusBadge status={r.vehicles.status} />
                </div>
              </div>

              <VeiStatusPicker
                status={r.status}
                disabled={busyId === r.id}
                onChange={(status) => changeStatus(r, status)}
              />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
