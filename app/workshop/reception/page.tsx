"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MANAGER_NAV } from "@/lib/manager";
import {
  fetchManagerReceptionList,
  isReceptionComplete,
  type ManagerReceptionListMode,
} from "@/lib/manager-pipeline";
import { STATUS_LABELS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

type ReceptionRow = Awaited<ReturnType<typeof fetchManagerReceptionList>>[number] & {
  veiStatus?: string | null;
  veiExpert?: string | null;
};

const MODES: { id: ManagerReceptionListMode; label: string; hint: string }[] = [
  {
    id: "pipeline",
    label: "En cours",
    hint: "Arrivées et véhicules en attente d'assignation",
  },
  {
    id: "all",
    label: "Tous les véhicules",
    hint: "Historique complet — cliquez pour voir ou modifier",
  },
];

export default function ReceptionListPage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<ReceptionRow[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ManagerReceptionListMode>("pipeline");
  const [loading, setLoading] = useState(true);

  async function load(listMode = mode, query = search) {
    setLoading(true);
    const rows = await fetchManagerReceptionList(listMode, query);
    const veiIds = rows.filter((v) => v.vei_procedure).map((v) => v.id);
    const veiByVehicle = new Map<string, { status: string; expert_name: string | null }>();

    if (veiIds.length > 0) {
      const { data: veiCases } = await supabase
        .from("vei_cases")
        .select("vehicle_id, status, expert_name")
        .in("vehicle_id", veiIds);
      for (const row of veiCases ?? []) {
        veiByVehicle.set(row.vehicle_id, row);
      }
    }

    setVehicles(
      rows.map((vehicle) => {
        const vei = veiByVehicle.get(vehicle.id);
        return {
          ...vehicle,
          veiStatus: vei?.status ?? null,
          veiExpert: vei?.expert_name ?? null,
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => {
    load(mode, search);
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(() => load(mode, search), 300);
    return () => clearTimeout(t);
  }, [search, mode]);

  useEffect(() => {
    const ch = supabase
      .channel("reception-list")
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
  }, [mode, search]);

  if (!user) return <LoadingPage />;

  const activeMode = MODES.find((m) => m.id === mode)!;
  const isSearching = search.trim().length > 0;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Réception atelier"
        subtitle="Consultez et modifiez les fiches véhicules — en cours ou passées."
      />

      <input
        type="search"
        className="input-field mb-4"
        placeholder="Rechercher immatriculation, marque, client, VIN, provenance…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Rechercher un véhicule"
      />

      {!isSearching && (
        <div className="mb-4 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={mode === m.id ? "btn-chip-active" : "btn-chip-inactive"}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <p className="mb-6 text-sm text-slate-500">
        {isSearching
          ? `Résultats de recherche pour « ${search.trim()} »`
          : activeMode.hint}
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule trouvé"
          description={
            isSearching
              ? "Essayez une autre recherche ou effacez le filtre."
              : "Les nouveaux arrivages apparaîtront ici."
          }
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => {
            const receptionDone = isReceptionComplete(v, v.exteriorPhotoCount);

            return (
              <Link
                key={v.id}
                href={`/workshop/reception/${v.id}`}
                className="card-interactive block group"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 group-hover:text-slate-950">
                        {v.license_plate}
                      </p>
                      {v.vei_procedure && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          VEI
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          receptionDone
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {receptionDone ? "Réception OK" : "Réception incomplète"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {v.make} {v.model}
                      {v.client_name && ` · ${v.client_name}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Arrivée {v.arrival_date}
                      {v.vin && ` · VIN ${v.vin}`}
                      {` · Photos ${v.exteriorPhotoCount}/4`}
                      {` · ${STATUS_LABELS[v.status]}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={v.status} />
                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">
                      Modifier →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
