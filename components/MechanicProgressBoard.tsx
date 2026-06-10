import Link from "next/link";
import { PriorityBadge } from "@/components/VehicleCard";
import { StatusBadge } from "@/components/StatusBadge";
import type { VehicleWithMechanic } from "@/lib/workshop-vehicles";
import type { User } from "@/lib/types";

export function MechanicProgressBoard({
  mechanics,
  assigned,
}: {
  mechanics: User[];
  assigned: VehicleWithMechanic[];
}) {
  const slots = [1, 2, 3];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {slots.map((slot) => {
        const mechanic = mechanics.find((m) => m.mechanic_slot === slot);
        const vehicles = assigned.filter(
          (v) => v.assigned_mechanic_id === mechanic?.id
        );

        return (
          <div key={slot} className="card-padded">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900">Mécanicien {slot}</h3>
              <p className="text-sm text-slate-500">
                {mechanic?.full_name ?? "Non configuré"}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                {vehicles.length} véhicule(s) en cours
              </p>
            </div>

            {vehicles.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun véhicule assigné</p>
            ) : (
              <ul className="space-y-2">
                {vehicles.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/workshop/vehicle/${v.id}`}
                      className="block rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{v.license_plate}</span>
                            <PriorityBadge priority={v.dispatch_priority} />
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {v.make} {v.model}
                          </p>
                        </div>
                        <StatusBadge status={v.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
