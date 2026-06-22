"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { PartPricingEditor } from "@/components/PartPricingEditor";
import {
  MarkAllPartsReadyButton,
  PartReceiptControls,
} from "@/components/PartReceiptControls";
import { PartsListApprovalPanel } from "@/components/PartsListApprovalPanel";
import { PartsCostDocumentButton } from "@/components/PartsCostDocumentButton";
import { StorekeeperPartStatusControls } from "@/components/StorekeeperPartStatusControls";
import { ReportedIssuesPanel } from "@/components/ReportedIssuesPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { PART_STATUS_LABELS, ISSUE_CATEGORIES, ISSUE_CATEGORY_LABELS, type IssueCategory } from "@/lib/constants";
import { MANAGER_NAV } from "@/lib/manager";
import {
  fetchPhotosEtProblemesVehicles,
  filterSignalementsByCategory,
  type PhotosEtProblemesVehicle,
} from "@/lib/photos-et-problemes";
import {
  PARTS_SUMMARY_LABELS,
  summarizeVehicleParts,
} from "@/lib/parts-orders";
import { formatEuro } from "@/lib/parts-costs";
import { fetchVehiclePartsApproval, type VehiclePartsApproval } from "@/lib/parts-approval";
import { ADMIN_NAV } from "@/lib/role-nav";
import { STOREKEEPER_NAV } from "@/lib/storekeeper";
import { useSession } from "@/lib/session-context";
import { supabase } from "@/lib/supabase";

export default function PartsPage() {
  const user = useSession();
  const [rows, setRows] = useState<PhotosEtProblemesVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | "all">("all");

  const isStorekeeper = user?.role === "storekeeper";
  const isManager = user?.role === "workshop_manager";
  const isAdmin = user?.role === "admin";

  async function load() {
    if (!user) return;
    setRows(await fetchPhotosEtProblemesVehicles());
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("parts-work")
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, () =>
        load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_reported_issues" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diagnostics" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, user?.role]);

  if (!user) return <LoadingPage />;

  const nav = isAdmin
    ? [...ADMIN_NAV]
    : isManager
      ? [...MANAGER_NAV]
      : [...STOREKEEPER_NAV];

  const query = search.trim().toLowerCase();
  const filtered = query
    ? rows.filter(
        (row) =>
          row.vehicle.license_plate.toLowerCase().includes(query) ||
          row.vehicle.make.toLowerCase().includes(query) ||
          row.vehicle.model.toLowerCase().includes(query)
      )
    : rows;

  const displayRows =
    isStorekeeper && categoryFilter !== "all"
      ? filtered.filter(
          (row) =>
            row.signalements.some((s) => s.problem_category === categoryFilter) ||
            row.parts.length > 0
        )
      : filtered;

  return (
    <AppShell user={user} nav={nav}>
      <PageHeader
        title="Photos et problèmes"
        subtitle={
          isStorekeeper
            ? "Signalements mécanicien — commandez les pièces puis suivez les statuts"
            : "Check-list initiale — chaque « ! » indique un point examiné avec problème, photo et pièce"
        }
      />

      {isStorekeeper && (
        <p className="mb-4 text-sm text-slate-600">
          Consultez les signalements classés <strong>mécanique</strong> ou{" "}
          <strong>carrosserie</strong>, puis commandez les pièces.
        </p>
      )}

      {isStorekeeper && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={categoryFilter === "all" ? "btn-chip-active" : "btn-chip-inactive"}
          >
            Tous les signalements
          </button>
          {ISSUE_CATEGORIES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategoryFilter(key)}
              className={categoryFilter === key ? "btn-chip-active" : "btn-chip-inactive"}
            >
              {ISSUE_CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>
      )}

      {isStorekeeper && (
        <p className="mb-4 text-sm text-slate-600">
          Vue détaillée des statuts aussi sur{" "}
          <Link href="/parts/orders" className="font-medium text-slate-900 underline">
            Commandes pièces
          </Link>
          .
        </p>
      )}

      {isManager && (
        <p className="mb-4 text-sm text-slate-600">
          Les pièces oubliées après réception sont validées sur{" "}
          <a href="/workshop/issues" className="font-medium text-slate-900 underline">
            Signalements
          </a>
          .
        </p>
      )}

      {isStorekeeper && (
        <label className="mb-6 block">
          <span className="sr-only">Rechercher par immatriculation</span>
          <input
            type="search"
            className="input-field"
            placeholder="Rechercher par immatriculation, marque…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher par immatriculation"
          />
        </label>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : displayRows.length === 0 ? (
        <EmptyState
          title={query ? "Aucun véhicule trouvé" : "Aucune check-list soumise"}
          description={
            query
              ? "Essayez une autre immatriculation ou effacez la recherche."
              : categoryFilter !== "all"
                ? `Aucun signalement « ${ISSUE_CATEGORY_LABELS[categoryFilter]} » pour le moment.`
                : "Après soumission de la check-list initiale, les signalements apparaîtront ici."
          }
        />
      ) : (
        <div className="space-y-3">
          {displayRows.map((row) =>
            isStorekeeper ? (
              <StorekeeperVehicleCard
                key={row.vehicle.id}
                row={row}
                categoryFilter={categoryFilter}
                onPricingSaved={load}
              />
            ) : (
              <StaffVehicleCard key={row.vehicle.id} row={row} isAdmin={isAdmin} />
            )
          )}
        </div>
      )}
    </AppShell>
  );
}

function StorekeeperVehicleCard({
  row,
  categoryFilter,
  onPricingSaved,
}: {
  row: PhotosEtProblemesVehicle;
  categoryFilter: IssueCategory | "all";
  onPricingSaved: () => void | Promise<void>;
}) {
  const signalements = filterSignalementsByCategory(row.signalements, categoryFilter);
  const signalementCount = signalements.length;
  const photoCount = signalements.reduce(
    (n, s) => n + (s.photo_paths?.length ?? 0),
    0
  );
  const partsPhase = summarizeVehicleParts(
    row.parts,
    row.vehicle.parts_list_status
  );
  const isCompact =
    partsPhase === "ordered" ||
    partsPhase === "received" ||
    partsPhase === "ready_for_mechanic";
  const [approval, setApproval] = useState<VehiclePartsApproval | null>(null);

  useEffect(() => {
    fetchVehiclePartsApproval(row.vehicle.id).then(setApproval);
  }, [row.vehicle.id, row.parts]);

  async function refreshApproval() {
    setApproval(await fetchVehiclePartsApproval(row.vehicle.id));
    await onPricingSaved();
  }

  return (
    <details
      className={`card-padded group ${isCompact ? "!py-3" : ""}`}
      open={!isCompact && signalementCount <= 3}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {isCompact ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <p className="font-semibold text-slate-900">{row.vehicle.license_plate}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  partsPhase === "received"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-indigo-100 text-indigo-900"
                }`}
              >
                {partsPhase ? PARTS_SUMMARY_LABELS[partsPhase] : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <PartsCostDocumentButton
                vehicle={row.vehicle}
                parts={row.parts}
                compact
              />
              <span className="text-xs text-slate-500">Modifier →</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{row.vehicle.license_plate}</p>
              <p className="text-sm text-slate-600">
                {row.vehicle.make} {row.vehicle.model}
                {row.mechanicName && ` · ${row.mechanicName}`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Check-list soumise le{" "}
                {new Date(row.submittedAt).toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <PartsCostDocumentButton
                vehicle={row.vehicle}
                parts={row.parts}
                compact
              />
              <StatusBadge status={row.vehicle.status} />
              {signalementCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {signalementCount} signalement{signalementCount > 1 ? "s" : ""}
                  {photoCount > 0 && ` · ${photoCount} photo${photoCount > 1 ? "s" : ""}`}
                </span>
              )}
              {row.parts.length > 0 && partsPhase && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {PARTS_SUMMARY_LABELS[partsPhase]}
                </span>
              )}
            </div>
          </div>
        )}
      </summary>

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        {isCompact && (
          <p className="text-sm text-slate-600">
            {row.vehicle.make} {row.vehicle.model}
            {row.mechanicName && ` · ${row.mechanicName}`}
          </p>
        )}

        {signalementCount > 0 && <ReportedIssuesPanel issues={signalements} />}

        {row.parts.length > 0 && (
          <div className={signalementCount > 0 ? "border-t border-slate-100 pt-4" : undefined}>
            {approval && (
              <PartsListApprovalPanel approval={approval} onUpdated={refreshApproval} />
            )}
            <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">Détails commande</h4>
              <MarkAllPartsReadyButton
                vehicleId={row.vehicle.id}
                parts={row.parts}
                onUpdated={refreshApproval}
              />
            </div>
            <div className="space-y-3">
              {row.parts.map((p) => (
                <div key={p.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{p.part_name}</p>
                  <PartPricingEditor part={p} onSaved={refreshApproval} />
                  <StorekeeperPartStatusControls
                    part={p}
                    licensePlate={row.vehicle.license_plate}
                    partsListStatus={row.vehicle.parts_list_status}
                    onUpdated={refreshApproval}
                  />
                  <PartReceiptControls
                    part={{
                      id: p.id,
                      part_name: p.part_name,
                      quantity: p.quantity,
                      quantity_received: p.quantity_received ?? 0,
                      status: p.status,
                    }}
                    vehicleId={row.vehicle.id}
                    onUpdated={refreshApproval}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function StaffVehicleCard({
  row,
  isAdmin,
}: {
  row: PhotosEtProblemesVehicle;
  isAdmin: boolean;
}) {
  const signalementCount = row.signalements.length;
  const photoCount = row.signalements.reduce(
    (n, s) => n + (s.photo_paths?.length ?? 0),
    0
  );
  const hasSignalements = signalementCount > 0 || row.parts.length > 0;

  return (
    <details
      className="card-padded group"
      open={hasSignalements && signalementCount <= 3}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{row.vehicle.license_plate}</p>
            <p className="text-sm text-slate-600">
              {row.vehicle.make} {row.vehicle.model}
              {row.mechanicName && ` · ${row.mechanicName}`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Check-list soumise le {new Date(row.submittedAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <PartsCostDocumentButton
              vehicle={row.vehicle}
              parts={row.parts}
              compact
            />
            <StatusBadge status={row.vehicle.status} />
            {hasSignalements ? (
              <>
                {signalementCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    {signalementCount} signalement{signalementCount > 1 ? "s" : ""}
                    {photoCount > 0 && ` · ${photoCount} photo${photoCount > 1 ? "s" : ""}`}
                  </span>
                )}
                {row.parts.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">
                    {row.parts.length} pièce{row.parts.length > 1 ? "s" : ""}
                  </span>
                )}
              </>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Points examinés — rien à signaler
              </span>
            )}
          </div>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        {signalementCount > 0 ? (
          <ReportedIssuesPanel
            issues={filterSignalementsByCategory(row.signalements, "all")}
          />
        ) : hasSignalements ? null : (
          <p className="text-sm text-slate-500">
            Le mécanicien a coché les points sans signaler de problème via « ! ».
          </p>
        )}

        {row.parts.length > 0 && (
          <div className={signalementCount > 0 ? "border-t border-slate-100 pt-4" : undefined}>
            <h4 className="mb-3 text-sm font-semibold text-slate-800">Pièces nécessaires</h4>
            <div className="space-y-3">
              {row.parts.map((p) =>
                isAdmin ? (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{p.part_name}</p>
                      <p className="text-slate-500">
                        {PART_STATUS_LABELS[p.status] ?? p.status}
                        {p.supplier && ` · ${p.supplier}`}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {p.lineTotal > 0 ? formatEuro(p.lineTotal) : "—"}
                    </p>
                  </div>
                ) : (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"
                  >
                    <p className="font-medium">{p.part_name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {PART_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
