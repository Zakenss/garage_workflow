"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { VEI_STATUS_LABELS } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";

type VeiRow = {
  id: string;
  status: string;
  expert_name: string | null;
  appointment_date: string | null;
  vehicles: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
  };
};

export default function VeiListPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<VeiRow[]>([]);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vei_cases")
      .select("*, vehicles(id, license_plate, make, model)")
      .order("created_at", { ascending: false });
    setRows((data as VeiRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/workshop/vei", label: "Liste VEI" },
      ]}
    >
      <h1 className="mb-6 text-2xl font-bold">Véhicules VEI</h1>
      <div className="space-y-3">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/workshop/reception/${r.vehicles.id}`}
            className="block rounded-xl border bg-white p-4 hover:bg-slate-50"
          >
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{r.vehicles.license_plate}</p>
                <p className="text-sm text-slate-600">
                  {r.vehicles.make} {r.vehicles.model}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                {VEI_STATUS_LABELS[r.status]}
              </span>
            </div>
            {r.expert_name && (
              <p className="mt-2 text-xs text-slate-500">
                Expert : {r.expert_name}
                {r.appointment_date && ` — ${r.appointment_date}`}
              </p>
            )}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
