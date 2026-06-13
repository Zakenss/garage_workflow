"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
import { MECHANIC_NAV } from "@/lib/role-nav";
import { findVehicleByPlate } from "@/lib/mechanic-issues";
import type { SessionUser } from "@/lib/types";

export default function FollowupSearchPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [plate, setPlate] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSearching(true);
    const vehicle = await findVehicleByPlate(plate);
    setSearching(false);
    if (!vehicle) {
      setError("Aucun véhicule trouvé avec cette immatriculation.");
      return;
    }
    router.push(`/vehicles/followup/${vehicle.id}`);
  }

  if (!user) return <LoadingPage />;

  return (
    <AppShell user={user} nav={[...MECHANIC_NAV]}>
      <PageHeader
        title="Signalements véhicule"
        subtitle="Consulter les problèmes passés ou en ajouter un nouveau"
      />

      <form onSubmit={handleSearch} className="card-padded max-w-lg space-y-4">
        <label className="label-field">
          Immatriculation du véhicule
          <input
            type="text"
            className="input-field mt-1.5 uppercase"
            placeholder="AB-123-CD"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            required
          />
        </label>
        {error && <Alert variant="error">{error}</Alert>}
        <button type="submit" disabled={searching} className="btn-primary-block">
          {searching ? "Recherche…" : "Afficher le dossier"}
        </button>
      </form>
    </AppShell>
  );
}
