"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function ValidationListPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .in("status", ["parts_pending", "validation_pending", "diagnostic_complete"])
      .order("updated_at", { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (!user) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/workshop/validation", label: "Validation technique" },
      ]}
    >
      <PageHeader
        title="Validation technique"
        subtitle="Décider réparer ou remplacer pour chaque pièce"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule à valider"
          description="Les diagnostics terminés apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              href={`/workshop/validation/${v.id}`}
              className="card-interactive"
            >
              <p className="font-semibold">{v.license_plate}</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {v.make} {v.model}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
