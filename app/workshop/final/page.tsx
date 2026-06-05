"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function FinalListPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .in("status", ["repair_complete", "bodywork_complete"])
      .order("updated_at", { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
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
        { href: "/workshop/final", label: "Validation finale" },
      ]}
    >
      <h1 className="mb-6 text-2xl font-bold">Validation finale</h1>
      <div className="space-y-2">
        {vehicles.map((v) => (
          <Link
            key={v.id}
            href={`/workshop/final/${v.id}`}
            className="block rounded-xl border bg-white p-4"
          >
            {v.license_plate} — {v.make} {v.model}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
