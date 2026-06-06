"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("parts")
      .select("*, vehicles(license_plate, assigned_mechanic_id)")
      .order("created_at", { ascending: false });
    setParts((data as PartRow[]) ?? []);
    setLoading(false);
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

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[{ href: "/parts", label: "Pièces / stock" }]}>
      <PageHeader
        title="Pièces & stock"
        subtitle="Gérer les commandes et notifier les mécaniciens"
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : parts.length === 0 ? (
        <EmptyState
          title="Aucune pièce en attente"
          description="Les pièces issues des diagnostics apparaîtront ici."
        />
      ) : (
        <div className="space-y-4">
          {parts.map((p) => (
            <div key={p.id} className="card-padded">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{p.part_name}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {p.vehicles.license_plate} · Qté {p.quantity}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(p, s)}
                    className={
                      p.status === s ? "btn-chip-active" : "btn-chip-inactive"
                    }
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
