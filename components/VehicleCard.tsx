import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import type { Vehicle } from "@/lib/types";

export function VehicleCard({
  vehicle,
  href,
  subtitle,
}: {
  vehicle: Vehicle;
  href: string;
  subtitle?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{vehicle.license_plate}</p>
          <p className="text-sm text-slate-600">
            {vehicle.make} {vehicle.model}
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <StatusBadge status={vehicle.status} />
      </div>
      {vehicle.vei_procedure && (
        <p className="mt-2 text-xs font-medium text-amber-700">Procédure VEI</p>
      )}
    </Link>
  );
}
