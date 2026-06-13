"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function FinalListPage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .in("status", ["repair_complete", "bodywork_complete"])
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
        { href: "/workshop/final", label: "Validation finale" },
      ]}
    >
      <PageHeader
        title="Validation finale"
        subtitle="Contrôle final avant mise en vente"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule en validation finale"
          description="Les réparations terminées apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              href={`/workshop/final/${v.id}`}
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
