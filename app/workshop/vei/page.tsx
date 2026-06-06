"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { MANAGER_NAV } from "@/lib/manager";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vei_cases")
      .select("*, vehicles(id, license_plate, make, model)")
      .order("created_at", { ascending: false });
    setRows((data as VeiRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Liste VEI"
        subtitle="Véhicules avec procédure d'expertise"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun dossier VEI" />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/workshop/reception/${r.vehicles.id}`}
              className="card-interactive"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{r.vehicles.license_plate}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {r.vehicles.make} {r.vehicles.model}
                  </p>
                </div>
                <span className="inline-flex shrink-0 self-start rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                  {VEI_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
              {r.expert_name && (
                <p className="mt-3 text-xs text-slate-500">
                  Expert : {r.expert_name}
                  {r.appointment_date && ` — ${r.appointment_date}`}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
