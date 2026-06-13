"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import type { Vehicle } from "@/lib/types";

type Quote = {
  id: string;
  part_name: string;
  action_type: string;
  quantity: number;
  unit_price: number;
};

export default function ValidationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSession();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "repair" | "replace">>({});

  useEffect(() => {
    async function load() {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).single();
      setVehicle(v as Vehicle);
      const { data: d } = await supabase
        .from("diagnostics")
        .select("id")
        .eq("vehicle_id", id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (d) {
        const { data: q } = await supabase
          .from("diagnostic_quotes")
          .select("*")
          .eq("diagnostic_id", d.id);
        setQuotes((q as Quote[]) ?? []);
        const init: Record<string, "repair" | "replace"> = {};
        (q as Quote[])?.forEach((line) => {
          init[line.id] = line.action_type as "repair" | "replace";
        });
        setDecisions(init);
      }
    }
    load();
  }, [id]);

  async function validate() {
    if (!user) return;
    for (const q of quotes) {
      await supabase.from("validation_items").insert({
        vehicle_id: id,
        quote_id: q.id,
        part_name: q.part_name,
        decision: decisions[q.id] ?? q.action_type,
        validated_by: user.id,
      });
    }
    await supabase.from("repairs").upsert({
      vehicle_id: id,
      mechanic_id: vehicle!.assigned_mechanic_id!,
      status: "not_started",
    });
    await updateVehicleStatus(id, "repair_in_progress", user);
    router.push("/dashboard");
  }

  if (!user || !vehicle) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/workshop/validation", label: "Validation" },
        { href: `/workshop/validation/${id}`, label: vehicle.license_plate },
      ]}
    >
      <div className="mb-6">
        <h1 className="page-title">Validation — {vehicle.license_plate}</h1>
        <p className="page-subtitle">Choisir réparer ou remplacer pour chaque ligne</p>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="Aucune ligne de devis"
          description="Le diagnostic doit être complété avant la validation."
        />
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="card-padded flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{q.part_name}</p>
                <p className="text-sm text-slate-500">
                  {q.quantity} × {q.unit_price} €
                </p>
              </div>
              <select
                className="input-field !w-auto min-w-[140px]"
                value={decisions[q.id]}
                onChange={(e) =>
                  setDecisions({
                    ...decisions,
                    [q.id]: e.target.value as "repair" | "replace",
                  })
                }
                aria-label={`Décision pour ${q.part_name}`}
              >
                <option value="repair">Réparer</option>
                <option value="replace">Remplacer</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {quotes.length > 0 && (
        <button type="button" onClick={validate} className="btn-primary-block mt-6">
          Valider et lancer réparation
        </button>
      )}
    </AppShell>
  );
}
