"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { updateVehicleStatus } from "@/lib/db";
import type { SessionUser, Vehicle } from "@/lib/types";

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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "repair" | "replace">>({});

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

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

  if (!user || !vehicle) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/workshop/validation", label: "Validation" },
        { href: `/workshop/validation/${id}`, label: vehicle.license_plate },
      ]}
    >
      <h1 className="text-2xl font-bold">Validation — {vehicle.license_plate}</h1>
      <div className="mt-6 space-y-3">
        {quotes.map((q) => (
          <div key={q.id} className="flex items-center justify-between rounded-xl border bg-white p-4">
            <div>
              <p className="font-medium">{q.part_name}</p>
              <p className="text-sm text-slate-500">
                {q.quantity} × {q.unit_price} €
              </p>
            </div>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={decisions[q.id]}
              onChange={(e) =>
                setDecisions({
                  ...decisions,
                  [q.id]: e.target.value as "repair" | "replace",
                })
              }
            >
              <option value="repair">Réparer</option>
              <option value="replace">Remplacer</option>
            </select>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={validate}
        className="mt-6 w-full rounded-lg bg-slate-900 py-3 text-white"
      >
        Valider et lancer réparation
      </button>
    </AppShell>
  );
}
