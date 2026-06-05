"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function ValidationListPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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
        { href: "/workshop/validation", label: "Validation technique" },
      ]}
    >
      <h1 className="mb-6 text-2xl font-bold">Validation technique</h1>
      <div className="space-y-2">
        {vehicles.map((v) => (
          <Link
            key={v.id}
            href={`/workshop/validation/${v.id}`}
            className="block rounded-xl border bg-white p-4 hover:bg-slate-50"
          >
            <p className="font-semibold">{v.license_plate}</p>
            <p className="text-sm text-slate-600">
              {v.make} {v.model}
            </p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
