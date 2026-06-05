"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PhotoUpload } from "@/components/PhotoUpload";
import { SignaturePad } from "@/components/SignaturePad";
import { supabase } from "@/lib/supabase";
import { notifyRole, updateVehicleStatus } from "@/lib/db";
import type { SessionUser, Vehicle } from "@/lib/types";

type QuoteLine = {
  part_name: string;
  quantity: number;
  unit_price: number;
  action_type: "repair" | "replace";
};

export default function DiagnosticPage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
  const [form, setForm] = useState({
    defects: "",
    defective_parts: "",
    parts_to_replace: "",
    parts_to_repair: "",
    additional_needs: "",
    estimated_hours: "",
  });
  const [quotes, setQuotes] = useState<QuoteLine[]>([
    { part_name: "", quantity: 1, unit_price: 0, action_type: "replace" },
  ]);
  const [signature, setSignature] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function ensureDiagnostic(mechanicId: string) {
    const { data: existing } = await supabase
      .from("diagnostics")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .eq("status", "in_progress")
      .maybeSingle();
    if (existing) {
      setDiagnosticId(existing.id);
      return existing.id;
    }
    const { data: created } = await supabase
      .from("diagnostics")
      .insert({ vehicle_id: vehicleId, mechanic_id: mechanicId })
      .select("id")
      .single();
    setDiagnosticId(created!.id);
    return created!.id;
  }

  useEffect(() => {
    async function init() {
      const { data: v } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .single();
      setVehicle(v as Vehicle);
      if (user) await ensureDiagnostic(user.id);
    }
    if (user) init();
  }, [user, vehicleId]);

  async function saveDiagnosticPhotos(paths: string[]) {
    if (!diagnosticId) return;
    await supabase.from("diagnostic_photos").insert(
      paths.map((p) => ({ diagnostic_id: diagnosticId, storage_path: p }))
    );
  }

  async function completeDiagnostic() {
    if (!user || !diagnosticId) return;
    if (!signature) {
      alert("Signature requise.");
      return;
    }

    await supabase
      .from("diagnostics")
      .update({
        ...form,
        estimated_hours: form.estimated_hours
          ? parseFloat(form.estimated_hours)
          : null,
        signature_data: signature,
        signed_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", diagnosticId);

    const validQuotes = quotes.filter((q) => q.part_name.trim());
    if (validQuotes.length) {
      await supabase.from("diagnostic_quotes").insert(
        validQuotes.map((q) => ({ ...q, diagnostic_id: diagnosticId }))
      );
      await supabase.from("parts").insert(
        validQuotes.map((q) => ({
          vehicle_id: vehicleId,
          diagnostic_id: diagnosticId,
          part_name: q.part_name,
          quantity: q.quantity,
          status: "to_order",
        }))
      );
    }

    await updateVehicleStatus(vehicleId, "diagnostic_complete", user, {
      diagnostic_completed_at: new Date().toISOString(),
    });
    await supabase
      .from("vehicles")
      .update({ status: "parts_pending" })
      .eq("id", vehicleId);

    await notifyRole(
      "workshop_manager",
      "diagnostic_complete",
      `Diagnostic terminé — ${vehicle?.license_plate}`,
      vehicleId
    );
    await notifyRole(
      "storekeeper",
      "diagnostic_complete",
      `Pièces à traiter — ${vehicle?.license_plate}`,
      vehicleId
    );

    router.push("/vehicles/my");
  }

  if (!user || !vehicle) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/vehicles/my", label: "Mes véhicules" },
        { href: `/vehicles/diagnostic/${vehicleId}`, label: "Diagnostic" },
      ]}
    >
      <h1 className="text-2xl font-bold">
        Diagnostic — {vehicle.license_plate}
      </h1>

      <div className="mt-6 space-y-4 rounded-xl border bg-white p-6">
        {(
          [
            ["defects", "Défauts détectés"],
            ["defective_parts", "Pièces défectueuses"],
            ["parts_to_replace", "Pièces à remplacer"],
            ["parts_to_repair", "Pièces à réparer"],
            ["additional_needs", "Besoins supplémentaires"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm font-medium">
            {label}
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2"
              rows={2}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block text-sm font-medium">
          Temps estimé (heures)
          <input
            type="number"
            step="0.5"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.estimated_hours}
            onChange={(e) =>
              setForm({ ...form, estimated_hours: e.target.value })
            }
          />
        </label>

        <h2 className="font-semibold">Devis remise en état</h2>
        {quotes.map((q, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4">
            <input
              placeholder="Pièce"
              className="rounded border px-2 py-1 text-sm"
              value={q.part_name}
              onChange={(e) => {
                const next = [...quotes];
                next[i].part_name = e.target.value;
                setQuotes(next);
              }}
            />
            <input
              type="number"
              placeholder="Qté"
              className="rounded border px-2 py-1 text-sm"
              value={q.quantity}
              onChange={(e) => {
                const next = [...quotes];
                next[i].quantity = parseFloat(e.target.value) || 1;
                setQuotes(next);
              }}
            />
            <input
              type="number"
              placeholder="Prix"
              className="rounded border px-2 py-1 text-sm"
              value={q.unit_price}
              onChange={(e) => {
                const next = [...quotes];
                next[i].unit_price = parseFloat(e.target.value) || 0;
                setQuotes(next);
              }}
            />
            <select
              className="rounded border px-2 py-1 text-sm"
              value={q.action_type}
              onChange={(e) => {
                const next = [...quotes];
                next[i].action_type = e.target.value as "repair" | "replace";
                setQuotes(next);
              }}
            >
              <option value="replace">Remplacement</option>
              <option value="repair">Réparation</option>
            </select>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setQuotes([
              ...quotes,
              {
                part_name: "",
                quantity: 1,
                unit_price: 0,
                action_type: "replace",
              },
            ])
          }
          className="text-sm text-slate-600 underline"
        >
          + Ligne devis
        </button>

        <PhotoUpload
          bucket="diagnostic-photos"
          pathPrefix={`${vehicleId}/${diagnosticId}`}
          onUploaded={saveDiagnosticPhotos}
          label="Photos pièces / zones endommagées"
        />

        <h2 className="font-semibold">Signature électronique</h2>
        <SignaturePad onSave={setSignature} />
        {signature && (
          <p className="text-sm text-emerald-600">Signature enregistrée</p>
        )}

        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="w-full rounded-lg bg-slate-900 py-3 text-white"
        >
          Terminer le diagnostic
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-xl bg-white p-6">
            <p className="font-medium">
              Confirmez-vous que le diagnostic est complet et qu&apos;aucun
              élément n&apos;a été oublié ?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border py-2"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  completeDiagnostic();
                }}
                className="flex-1 rounded-lg bg-slate-900 py-2 text-white"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
