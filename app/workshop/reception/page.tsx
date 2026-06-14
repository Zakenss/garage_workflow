"use client";

import { useSession } from "@/lib/session-context";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { VehicleCard } from "@/components/VehicleCard";
import { MANAGER_NAV } from "@/lib/manager";
import {
  fetchArrivedReceptionStates,
  isReceptionComplete,
  isVeiReadyForWorkshop,
} from "@/lib/manager-pipeline";
import { supabase } from "@/lib/supabase";

type ReceptionRow = Awaited<ReturnType<typeof fetchArrivedReceptionStates>>[number] & {
  veiStatus?: string | null;
};

export default function ReceptionListPage() {
  const user = useSession();
  const [vehicles, setVehicles] = useState<ReceptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const arrived = await fetchArrivedReceptionStates();
    const veiIds = arrived.filter((v) => v.vei_procedure).map((v) => v.id);
    const veiByVehicle = new Map<string, string>();

    if (veiIds.length > 0) {
      const { data: veiCases } = await supabase
        .from("vei_cases")
        .select("vehicle_id, status")
        .in("vehicle_id", veiIds);
      for (const row of veiCases ?? []) {
        veiByVehicle.set(row.vehicle_id, row.status);
      }
    }

    setVehicles(
      arrived.map((vehicle) => ({
        ...vehicle,
        veiStatus: veiByVehicle.get(vehicle.id) ?? null,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("reception-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_photos" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MANAGER_NAV]}>
      <PageHeader
        title="Réception atelier"
        subtitle="Étape 1 — VIN et photos. Les véhicules VEI passent ensuite par l'expertise avant assignation."
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Aucun véhicule en attente"
          description="Les nouveaux arrivages apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => {
            const receptionDone = isReceptionComplete(v, v.exteriorPhotoCount);
            const stepLabel = !receptionDone
              ? "Réception à compléter"
              : v.vei_procedure && !isVeiReadyForWorkshop(v.veiStatus)
                ? "Réception OK — VEI en attente"
                : "Prêt pour l'atelier";

            return (
              <VehicleCard
                key={v.id}
                vehicle={v}
                href={`/workshop/reception/${v.id}`}
                subtitle={stepLabel}
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
