"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { ManagerDashboard } from "@/components/ManagerDashboard";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";
import type { SessionUser, Vehicle } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => {
        if (!r.ok) {
          router.replace("/login?from=/dashboard");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => router.replace("/login?from=/dashboard"));
  }, [router]);

  async function load() {
    const { data } = await supabase.from("vehicles").select("*").order("updated_at", {
      ascending: false,
    });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (user?.role === "admin") {
      load();
      const ch = supabase
        .channel("vehicles-dash")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "vehicles" },
          () => load()
        )
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }
  }, [user?.role]);

  if (!user) return <LoadingPage />;

  if (user.role === "workshop_manager") {
    return <ManagerDashboard user={user} />;
  }

  const filtered = vehicles.filter(
    (v) =>
      !search ||
      v.license_plate.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/users", label: "Utilisateurs" },
      ]}
    >
      <PageHeader
        title="Administration"
        subtitle="Vue globale du parc"
        action={<NotificationsBell user={user} />}
      />

      <input
        placeholder="Rechercher immatriculation, marque…"
        className="input-field mb-6"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Rechercher un véhicule"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun véhicule trouvé" />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className="card-interactive flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">{v.license_plate}</p>
                <p className="text-sm text-slate-600">
                  {v.make} {v.model}
                </p>
              </div>
              <StatusBadge status={v.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
