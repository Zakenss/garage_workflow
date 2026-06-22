"use client";

import { useSession } from "@/lib/session-context";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PageHeader } from "@/components/PageHeader";
import { PhotoUpload } from "@/components/PhotoUpload";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";
import {
  fetchFinalPhotos,
  fetchSellerVehicles,
  markVehicleWashed,
  saveExpertAppointment,
  saveFinalPhotos,
  setSellerSaleStatus,
  unmarkVehicleWashed,
  type FinalPhoto,
  type SellerVehicle,
} from "@/lib/seller";
import { SELLER_NAV } from "@/lib/role-nav";
import { supabase } from "@/lib/supabase";

type ListFilter = "prepare" | "active" | "sold";

function ReadySaleContent() {
  const user = useSession();
  const searchParams = useSearchParams();
  const vehicleFromUrl = searchParams.get("vehicle");

  const [vehicles, setVehicles] = useState<SellerVehicle[]>([]);
  const [selected, setSelected] = useState<SellerVehicle | null>(null);
  const [finalPhotos, setFinalPhotos] = useState<FinalPhoto[]>([]);
  const [filter, setFilter] = useState<ListFilter>("prepare");
  const [search, setSearch] = useState("");
  const [expert, setExpert] = useState({ name: "", date: "", time: "" });
  const [saleNotes, setSaleNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const list = await fetchSellerVehicles();
    setVehicles(list);
    setLoading(false);

    if (vehicleFromUrl) {
      const match = list.find((v) => v.id === vehicleFromUrl);
      if (match) selectVehicle(match);
    }
  }

  async function selectVehicle(v: SellerVehicle) {
    setSelected(v);
    setFeedback("");
    setError("");
    setExpert({
      name: v.seller_expert_name ?? "",
      date: v.seller_expert_date ?? "",
      time: v.seller_expert_time ?? "",
    });
    setSaleNotes(v.sale_notes ?? "");
    const photos = await fetchFinalPhotos(v.id);
    setFinalPhotos(photos);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("seller-ready-sale")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [vehicleFromUrl]);

  const statusFiltered = vehicles.filter((v) => {
    if (filter === "prepare") return v.status === "ready_to_sell";
    if (filter === "active") return v.status === "for_sale" || v.status === "reserved";
    return v.status === "sold";
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? statusFiltered.filter(
        (v) =>
          v.license_plate.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          (v.client_name?.toLowerCase().includes(q) ?? false) ||
          (v.sale_notes?.toLowerCase().includes(q) ?? false) ||
          (v.seller_expert_name?.toLowerCase().includes(q) ?? false)
      )
    : statusFiltered;

  async function handleSaveExpert() {
    if (!user || !selected) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await saveExpertAppointment(selected.id, expert, user);
      try {
        const calRes = await fetch("/api/calendar/expert-appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicleId: selected.id, expert }),
        });
        const calData = (await calRes.json()) as { synced?: boolean; error?: string };
        if (calData.error && calRes.status >= 400) {
          setFeedback(
            "Rendez-vous enregistré. Synchronisation Google Calendar indisponible."
          );
        } else if (calData.synced) {
          setFeedback("Rendez-vous expert enregistré et synchronisé avec Google Calendar.");
        } else {
          setFeedback("Rendez-vous expert enregistré.");
        }
      } catch {
        setFeedback("Rendez-vous expert enregistré (calendrier non synchronisé).");
      }
      const list = await fetchSellerVehicles();
      setVehicles(list);
      const updated = list.find((v) => v.id === selected.id);
      if (updated) await selectVehicle(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le RDV.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkWashed() {
    if (!user || !selected) return;
    setBusy(true);
    setError("");
    try {
      await markVehicleWashed(selected.id, user);
      setFeedback("Véhicule marqué comme lavé.");
      const list = await fetchSellerVehicles();
      setVehicles(list);
      const updated = list.find((v) => v.id === selected.id);
      if (updated) await selectVehicle(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de marquer comme lavé.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnmarkWashed() {
    if (!user || !selected) return;
    setBusy(true);
    setError("");
    try {
      await unmarkVehicleWashed(selected.id, user);
      setFeedback("Lavage annulé.");
      const list = await fetchSellerVehicles();
      setVehicles(list);
      const updated = list.find((v) => v.id === selected.id);
      if (updated) await selectVehicle(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'annuler le lavage.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePhotos(paths: string[]) {
    if (!user || !selected) return;
    setError("");
    try {
      await saveFinalPhotos(selected.id, paths, user.id);
      setFeedback("Photos finales enregistrées.");
      setFinalPhotos(await fetchFinalPhotos(selected.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer les photos.");
    }
  }

  async function handleSetStatus(status: "for_sale" | "reserved" | "sold") {
    if (!user || !selected) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await setSellerSaleStatus(
        selected.id,
        status,
        { expert, saleNotes },
        user
      );
      setSelected(null);
      setFeedback(
        status === "for_sale"
          ? "Véhicule mis en vente."
          : status === "reserved"
            ? "Véhicule marqué comme réservé."
            : "Véhicule marqué comme vendu."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le statut.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <LoadingPage />;

  const prepareCount = vehicles.filter((v) => v.status === "ready_to_sell").length;

  return (
    <AppShell user={user} nav={[...SELLER_NAV]}>
      <PageHeader
        title="Préparation vente"
        subtitle="Lavage, expert fin de travaux et mise en vente"
        action={<NotificationsBell user={user} />}
      />

      {prepareCount > 0 && !selected && (
        <Alert variant="warning" className="mb-6">
          {prepareCount === 1
            ? "1 véhicule prêt pour lavage et mise en vente"
            : `${prepareCount} véhicules prêts pour lavage et mise en vente`}
        </Alert>
      )}

      {feedback && !selected && (
        <Alert variant="success" className="mb-6">
          {feedback}
        </Alert>
      )}

      {!selected ? (
        <>
          <input
            type="search"
            className="input-field mb-4"
            placeholder="Rechercher immatriculation, marque, modèle, client, expert…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un véhicule"
          />

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["prepare", "À préparer"],
                ["active", "En vente / Réservé"],
                ["sold", "Vendus"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={filter === id ? "btn-chip-active" : "btn-chip-inactive"}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aucun véhicule"
              description={
                q
                  ? `Aucun résultat pour « ${search.trim()} » dans cette catégorie.`
                  : filter === "prepare"
                    ? "Les véhicules validés par l'atelier apparaîtront ici avec la notification « prêt pour lavage et mise en vente »."
                    : "Aucun véhicule dans cette catégorie."
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selectVehicle(v)}
                  className="card-interactive block w-full text-left"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{v.license_plate}</p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {v.make} {v.model}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {v.washed_at ? "Lavé · " : ""}
                        {v.seller_expert_name
                          ? `Expert : ${v.seller_expert_name} · `
                          : "Expert non planifié · "}
                        {STATUS_LABELS[v.status]}
                      </p>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setError("");
              setFeedback("");
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← Retour à la liste
          </button>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selected.license_plate}</h2>
              <p className="text-sm text-slate-600">
                {selected.make} {selected.model}
              </p>
            </div>
            <StatusBadge status={selected.status} />
          </div>

          {error && <Alert variant="error">{error}</Alert>}
          {feedback && <Alert variant="success">{feedback}</Alert>}

          <section className="card-padded space-y-4">
            <h3 className="section-title">1. Rendez-vous expert fin de travaux</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="label-field sm:col-span-3">
                Nom de l&apos;expert
                <input
                  className="input-field mt-1.5"
                  placeholder="Expert fin de travaux"
                  value={expert.name}
                  onChange={(e) => setExpert({ ...expert, name: e.target.value })}
                />
              </label>
              <label className="label-field">
                Date
                <input
                  type="date"
                  className="input-field mt-1.5"
                  value={expert.date}
                  onChange={(e) => setExpert({ ...expert, date: e.target.value })}
                />
              </label>
              <label className="label-field">
                Heure
                <input
                  type="time"
                  className="input-field mt-1.5"
                  value={expert.time}
                  onChange={(e) => setExpert({ ...expert, time: e.target.value })}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveExpert}
              className="btn-secondary w-full sm:!w-auto"
            >
              Enregistrer le RDV expert
            </button>
          </section>

          <section className="card-padded space-y-4">
            <h3 className="section-title">2. Lavage</h3>
            {selected.washed_at ? (
              <div className="space-y-3">
                <Alert variant="success">
                  Lavé le{" "}
                  {new Date(selected.washed_at).toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Alert>
                {selected.status === "ready_to_sell" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUnmarkWashed}
                    className="btn-secondary w-full sm:!w-auto"
                  >
                    Annuler le lavage
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleMarkWashed}
                className="btn-secondary w-full sm:!w-auto"
              >
                Marquer « Lavé »
              </button>
            )}
          </section>

          <section className="card-padded space-y-4">
            <h3 className="section-title">3. Photos finales</h3>
            {finalPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {finalPhotos.map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={p.url}
                      alt="Photo finale"
                      className="aspect-square rounded-lg border border-slate-200 object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
            <PhotoUpload
              bucket="vehicle-photos"
              pathPrefix={`${selected.id}/final`}
              label="Ajouter photos finales"
              onUploaded={handleSavePhotos}
            />
          </section>

          <section className="card-padded space-y-4">
            <h3 className="section-title">4. Mise en vente</h3>
            <label className="label-field">
              Notes (obligatoires pour Réservé ou Vendu)
              <textarea
                className="input-field mt-1.5 min-h-[88px] resize-y"
                placeholder="Client, prix, conditions…"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSetStatus("for_sale")}
                className="btn-success !w-full"
              >
                Mis en vente
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSetStatus("reserved")}
                className="btn bg-cyan-700 text-white hover:bg-cyan-800 focus-visible:ring-cyan-600 !w-full"
              >
                Réservé
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSetStatus("sold")}
                className="btn-primary-block"
              >
                Vendu
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

export default function ReadySalePage() {
  return (
    <Suspense fallback={<LoadingPage label="Chargement préparation vente…" />}>
      <ReadySaleContent />
    </Suspense>
  );
}
