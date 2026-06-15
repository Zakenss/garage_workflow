"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { SECRETARY_NAV } from "@/lib/secretary";
import { ADMIN_NAV } from "@/lib/role-nav";
import { useSession } from "@/lib/session-context";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";
import {
  deleteVehicleRecord,
  fetchRegistryVehicles,
  filterRegistryVehicles,
  updateVehicleRecord,
  vehicleToForm,
  type VehicleRegistryInput,
} from "@/lib/vehicle-registry";

export default function VehicleManagePage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleRegistryInput | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  async function load() {
    setVehicles(await fetchRegistryVehicles());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("vehicle-registry")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () =>
        load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (selected) {
      setForm(vehicleToForm(selected));
      setDeleteConfirm("");
    } else {
      setForm(null);
      setDeleteConfirm("");
    }
  }, [selectedId, selected?.updated_at]);

  function selectVehicle(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
    setMessage("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selected || !form) return;
    setSaving(true);
    setMessage("");
    try {
      await updateVehicleRecord(selected.id, user.id, form, {
        vei_procedure: selected.vei_procedure,
        license_plate: selected.license_plate,
      });
      setMessageType("success");
      setMessage(`Fiche ${form.license_plate.toUpperCase()} mise à jour.`);
      await load();
    } catch (err) {
      setMessageType("error");
      setMessage(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected || deleteConfirm.trim().toUpperCase() !== selected.license_plate) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteVehicleRecord(selected.id);
      setSelectedId(null);
      setMessageType("success");
      setMessage(`Véhicule ${selected.license_plate} supprimé.`);
      await load();
    } catch (err) {
      setMessageType("error");
      setMessage(err instanceof Error ? err.message : "Impossible de supprimer ce véhicule.");
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return <LoadingPage />;

  if (user.role !== "secretary" && user.role !== "admin") {
    return (
      <AppShell user={user} nav={[]}>
        <EmptyState title="Accès réservé à la secrétaire" />
      </AppShell>
    );
  }

  const nav =
    user.role === "admin" ? [...ADMIN_NAV] : [...SECRETARY_NAV];
  const filtered = filterRegistryVehicles(vehicles, search);
  const deleteMatches =
    selected && deleteConfirm.trim().toUpperCase() === selected.license_plate;

  return (
    <AppShell user={user} nav={nav}>
      <PageHeader
        title="Gestion des véhicules"
        subtitle="Rechercher, modifier ou supprimer une fiche véhicule"
      />

      {message && (
        <Alert variant={messageType} className="mb-6">
          {message}
        </Alert>
      )}

      <label className="mb-6 block">
        <span className="sr-only">Rechercher un véhicule</span>
        <input
          type="search"
          className="input-field"
          placeholder="Immatriculation, client, marque, modèle, VIN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un véhicule"
        />
      </label>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun véhicule trouvé"
          description={
            search
              ? "Essayez une autre recherche ou effacez le filtre."
              : "Les véhicules enregistrés apparaîtront ici."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const isOpen = selectedId === v.id;
            return (
              <div
                key={v.id}
                className={`card-padded ${isOpen ? "ring-2 ring-slate-900/10" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => selectVehicle(v.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{v.license_plate}</p>
                    <p className="text-sm text-slate-600">
                      {v.make} {v.model}
                      {v.client_name && ` · ${v.client_name}`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Arrivée {v.arrival_date}
                      {v.vei_procedure && " · VEI"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={v.status} />
                    <span className="text-xs text-slate-500">{isOpen ? "Fermer" : "Modifier"}</span>
                  </div>
                </button>

                {isOpen && form && (
                  <div className="mt-4 space-y-6 border-t border-slate-100 pt-4">
                    <form onSubmit={handleSave} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Immatriculation" required>
                          <input
                            className="input-field mt-1.5"
                            value={form.license_plate}
                            onChange={(e) =>
                              setForm({ ...form, license_plate: e.target.value })
                            }
                            required
                          />
                        </Field>
                        <Field label="Date d'arrivée" required>
                          <input
                            type="date"
                            className="input-field mt-1.5"
                            value={form.arrival_date}
                            onChange={(e) =>
                              setForm({ ...form, arrival_date: e.target.value })
                            }
                            required
                          />
                        </Field>
                        <Field label="Marque" required>
                          <input
                            className="input-field mt-1.5"
                            value={form.make}
                            onChange={(e) => setForm({ ...form, make: e.target.value })}
                            required
                          />
                        </Field>
                        <Field label="Modèle" required>
                          <input
                            className="input-field mt-1.5"
                            value={form.model}
                            onChange={(e) => setForm({ ...form, model: e.target.value })}
                            required
                          />
                        </Field>
                        <Field label="VIN / N° série">
                          <input
                            className="input-field mt-1.5"
                            value={form.vin}
                            onChange={(e) => setForm({ ...form, vin: e.target.value })}
                          />
                        </Field>
                        <Field label="Client">
                          <input
                            className="input-field mt-1.5"
                            value={form.client_name}
                            onChange={(e) =>
                              setForm({ ...form, client_name: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Provenance">
                          <input
                            className="input-field mt-1.5"
                            value={form.provenance}
                            onChange={(e) =>
                              setForm({ ...form, provenance: e.target.value })
                            }
                          />
                        </Field>
                      </div>

                      <label className="checkbox-field px-2">
                        <input
                          type="checkbox"
                          checked={form.vei_procedure}
                          onChange={(e) =>
                            setForm({ ...form, vei_procedure: e.target.checked })
                          }
                        />
                        Procédure VEI
                      </label>

                      <Field label="Notes">
                        <textarea
                          className="input-field mt-1.5 min-h-[88px] resize-y"
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        />
                      </Field>

                      <div className="flex flex-wrap gap-3">
                        <button type="submit" disabled={saving} className="btn-primary">
                          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
                        </button>
                        <Link
                          href={`/vehicles/${v.id}`}
                          className="btn-secondary inline-flex items-center"
                        >
                          Voir la fiche complète
                        </Link>
                      </div>
                    </form>

                    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                      <h3 className="text-sm font-semibold text-red-950">Supprimer le véhicule</h3>
                      <p className="mt-1 text-sm text-red-900">
                        Action irréversible — historique, photos et pièces associés seront
                        supprimés. Saisissez l&apos;immatriculation{" "}
                        <strong>{v.license_plate}</strong> pour confirmer.
                      </p>
                      <input
                        className="input-field mt-3"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={v.license_plate}
                        aria-label="Confirmer l'immatriculation pour supprimer"
                      />
                      <button
                        type="button"
                        disabled={!deleteMatches || deleting}
                        onClick={handleDelete}
                        className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-40"
                      >
                        {deleting ? "Suppression…" : "Supprimer définitivement"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="label-field">
      {label}
      {required && <span className="text-red-500"> *</span>}
      {children}
    </label>
  );
}
