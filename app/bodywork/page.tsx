"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { PhotoUpload } from "@/components/PhotoUpload";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import { maybeActivateMechanicFollowup } from "@/lib/parts-orders";
import { BODYWORKER_NAV } from "@/lib/role-nav";

type BodyworkRow = {
  id: string;
  status: string;
  notes: string | null;
  vehicle_id: string;
  source_part_id: string | null;
  vehicles: { license_plate: string; make: string; model: string };
  parts: { part_name: string } | null;
};

export default function BodyworkPage() {
  const user = useSession();
  const [items, setItems] = useState<BodyworkRow[]>([]);
  const [selected, setSelected] = useState<BodyworkRow | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("bodywork")
      .select("*, vehicles(license_plate, make, model), parts!source_part_id(part_name)")
      .eq("bodyworker_id", user.id)
      .neq("status", "completed")
      .order("created_at", { ascending: false });
    setItems((data as BodyworkRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function savePhotos(paths: string[], type: "before" | "after") {
    if (!selected) return;
    await supabase.from("bodywork_photos").insert(
      paths.map((p) => ({
        bodywork_id: selected.id,
        storage_path: p,
        photo_type: type,
      }))
    );
  }

  async function start() {
    if (!selected || !user) return;
    await supabase
      .from("bodywork")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        notes,
      })
      .eq("id", selected.id);
    if (!selected.source_part_id) {
      await updateVehicleStatus(selected.vehicle_id, "bodywork_in_progress", user);
    }
    load();
  }

  async function complete() {
    if (!selected || !user) return;
    await supabase
      .from("bodywork")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        notes,
      })
      .eq("id", selected.id);

    if (selected.source_part_id) {
      const { data: vehicle } = await supabase
        .from("vehicles")
        .select("parts_list_status")
        .eq("id", selected.vehicle_id)
        .single();
      const { data: part } = await supabase
        .from("parts")
        .select("quantity")
        .eq("id", selected.source_part_id)
        .single();
      const partStatus =
        vehicle?.parts_list_status != null ? "ready_for_mechanic" : "received";
      await supabase
        .from("parts")
        .update({
          status: partStatus,
          repair_action: null,
          quantity_received: part ? Number(part.quantity) : 1,
        })
        .eq("id", selected.source_part_id);
      await maybeActivateMechanicFollowup(selected.vehicle_id);
    } else {
      await updateVehicleStatus(selected.vehicle_id, "bodywork_complete", user);
    }

    setSelected(null);
    load();
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...BODYWORKER_NAV]}>
      <PageHeader
        title="Carrosserie"
        subtitle="Photos avant/après et suivi des travaux"
      />

      {!selected ? (
        loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucune carrosserie assignée"
            description="Les véhicules vous seront assignés par le chef d'atelier."
          />
        ) : (
          <div className="space-y-3">
            {items.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelected(b);
                  setNotes(b.notes ?? "");
                }}
                className="card-interactive"
              >
                <p className="font-semibold">{b.vehicles.license_plate}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {b.vehicles.make} {b.vehicles.model}
                </p>
                {b.source_part_id && (
                  <p className="mt-1 text-sm font-medium text-violet-800">
                    Réparation pièce : {b.parts?.part_name ?? "—"}
                  </p>
                )}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="card-padded space-y-5">
          <div>
            <p className="text-lg font-semibold">{selected.vehicles.license_plate}</p>
            <p className="text-sm text-slate-600">
              {selected.vehicles.make} {selected.vehicles.model}
            </p>
            {selected.source_part_id && (
              <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
                Réparation pièce : <strong>{selected.parts?.part_name ?? "—"}</strong>
              </p>
            )}
          </div>
          <label className="label-field">
            Notes carrosserie
            <textarea
              className="input-field mt-1.5 resize-y"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <PhotoUpload
            bucket="bodywork-photos"
            pathPrefix={selected.id}
            label="Photos avant"
            onUploaded={(p) => savePhotos(p, "before")}
          />
          <PhotoUpload
            bucket="bodywork-photos"
            pathPrefix={selected.id}
            label="Photos après"
            onUploaded={(p) => savePhotos(p, "after")}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="btn-secondary flex-1"
            >
              Retour
            </button>
            {selected.status === "not_started" && (
              <button type="button" onClick={start} className="btn-primary-block flex-1">
                Démarrer
              </button>
            )}
            {selected.status === "in_progress" && (
              <button type="button" onClick={complete} className="btn-success flex-1 !w-full">
                Terminer carrosserie
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
