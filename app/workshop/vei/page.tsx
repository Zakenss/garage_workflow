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
import { VEI_STATUS_LABELS } from "@/lib/constants";
import {
  fetchManagerVehicleSearch,
  fetchReceptionCompleteByVehicleIds,
  isReceptionComplete,
  isVeiCaseComplete,
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
  vehicle_id: string;
  vehicles: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
    status: VehicleStatus;
    vei_procedure: boolean;
    vin: string | null;
  };
  receptionComplete: boolean;
  veiComplete: boolean;
};

function vehicleFromJoin(v: unknown): VeiRow["vehicles"] | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as VeiRow["vehicles"]) ?? null;
  return v as VeiRow["vehicles"];
}

export default function VeiListPage() {
  const user = useSession();
  const [rows, setRows] = useState<VeiRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "ready" | "all">("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: veiData } = await supabase
      .from("vei_cases")
      .select(
        "id, status, expert_name, appointment_date, appointment_time, notes, vehicle_id, vehicles(id, license_plate, make, model, status, vei_procedure, vin)"
      )
      .order("updated_at", { ascending: false });

    let list: VeiRow[] = (veiData ?? [])
      .map((row) => {
        const vehicles = vehicleFromJoin(row.vehicles);
        if (!vehicles) return null;
        const veiComplete = isVeiCaseComplete({
          status: row.status,
          expert_name: row.expert_name,
        });
        return {
          id: row.id,
          status: row.status,
          expert_name: row.expert_name,
          appointment_date: row.appointment_date,
          appointment_time: row.appointment_time,
          notes: row.notes,
          vehicle_id: row.vehicle_id,
          vehicles,
          receptionComplete: false,
          veiComplete,
        };
      })
      .filter((r): r is VeiRow => r !== null);

    const receptionByVehicle = await fetchReceptionCompleteByVehicleIds(
      list.map((r) => r.vehicles.id)
    );
    list = list.map((row) => ({
      ...row,
      receptionComplete: receptionByVehicle.get(row.vehicles.id) ?? false,
    }));

    if (filter === "pending") {
      list = list.filter((row) => !row.veiComplete);
    } else if (filter === "ready") {
      list = list.filter((row) => row.veiComplete);
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

  if (!user) return <LoadingPage />;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? rows.filter(
        (r) =>
          r.vehicles.license_plate.toLowerCase().includes(query) ||
          r.vehicles.make.toLowerCase().includes(query) ||
          r.vehicles.model.toLowerCase().includes(query) ||
          (r.expert_name?.toLowerCase().includes(query) ?? false)
      )
    : rows;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Expertises VEI"
        subtitle="Gérez chaque dossier VEI — le mécanicien ne voit le véhicule qu'après expertise réalisée et expert confirmé."
      />

      <Alert variant="info" className="mb-6">
        Parcours VEI : réception complète → expertise planifiée/réalisée avec expert →
        assignation mécanicien.
      </Alert>

      <input
        type="search"
        className="input-field mb-4"
        placeholder="Rechercher immatriculation, expert…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Rechercher un dossier VEI"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={filter === "pending" ? "btn-chip-active" : "btn-chip-inactive"}
        >
          En cours
        </button>
        <button
          type="button"
          onClick={() => setFilter("ready")}
          className={filter === "ready" ? "btn-chip-active" : "btn-chip-inactive"}
        >
          Finalisées
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
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun dossier VEI"
          description={
            filter === "pending"
              ? "Toutes les expertises VEI en cours sont finalisées."
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="card-padded space-y-3">
              {!r.receptionComplete && (
                <Alert variant="info">
                  Réception incomplète —{" "}
                  <Link
                    href={`/workshop/reception/${r.vehicles.id}`}
                    className="font-medium underline"
                  >
                    terminer la réception
                  </Link>
                  .
                </Alert>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link
                    href={`/workshop/vei/${r.vehicles.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {r.vehicles.license_plate}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {r.vehicles.make} {r.vehicles.model}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.expert_name ? `Expert : ${r.expert_name}` : "Expert non renseigné"}
                    {r.appointment_date && ` · ${r.appointment_date}`}
                    {r.appointment_time && ` ${r.appointment_time.slice(0, 5)}`}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.veiComplete
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {r.veiComplete
                      ? "VEI finalisée"
                      : (VEI_STATUS_LABELS[r.status] ?? r.status)}
                  </span>
                  <StatusBadge status={r.vehicles.status} />
                </div>
              </div>
              <Link
                href={`/workshop/vei/${r.vehicles.id}`}
                className="inline-block text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Gérer le dossier VEI →
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
