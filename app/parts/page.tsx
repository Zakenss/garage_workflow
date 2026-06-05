"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { notifyUser } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

type PartRow = {
  id: string;
  part_name: string;
  quantity: number;
  status: string;
  vehicle_id: string;
  vehicles: {
    license_plate: string;
    assigned_mechanic_id: string | null;
  };
};

const STATUSES = ["in_stock", "to_order", "ordered", "received"] as const;
const STATUS_LABELS: Record<string, string> = {
  in_stock: "En stock",
  to_order: "À commander",
  ordered: "Commandée",
  received: "Reçue",
};

export default function PartsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [parts, setParts] = useState<PartRow[]>([]);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("parts")
      .select("*, vehicles(license_plate, assigned_mechanic_id)")
      .order("created_at", { ascending: false });
    setParts((data as PartRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(part: PartRow, status: string) {
    await supabase.from("parts").update({ status }).eq("id", part.id);
    if (status === "received" && part.vehicles.assigned_mechanic_id) {
      await notifyUser(
        part.vehicles.assigned_mechanic_id,
        "parts_received",
        `Pièces reçues — ${part.vehicles.license_plate}`,
        part.vehicle_id
      );
    }
    load();
  }

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell user={user} nav={[{ href: "/parts", label: "Pièces / stock" }]}>
      <h1 className="mb-6 text-2xl font-bold">Pièces & stock</h1>
      <div className="space-y-4">
        {parts.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white p-4">
            <p className="font-semibold">{p.part_name}</p>
            <p className="text-sm text-slate-600">
              {p.vehicles.license_plate} · Qté {p.quantity}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Statut : {STATUS_LABELS[p.status]}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(p, s)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    p.status === s
                      ? "bg-slate-900 text-white"
                      : "border text-slate-700"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
        {parts.length === 0 && (
          <p className="text-slate-500">Aucune pièce en attente.</p>
        )}
      </div>
    </AppShell>
  );
}
