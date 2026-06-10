import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import type { Vehicle } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: number | null | undefined }) {
  if (priority == null) return null;
  return (
    <span className="inline-flex shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
      #{priority}
    </span>
  );
}

export function VehicleCard({
  vehicle,
  href,
  subtitle,
  showPriority,
}: {
  vehicle: Vehicle;
  href: string;
  subtitle?: string;
  showPriority?: boolean;
}) {
  return (
    <Link href={href} className="card-interactive group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold tracking-tight text-slate-900 group-hover:text-slate-950">
              {vehicle.license_plate}
            </p>
            {showPriority && <PriorityBadge priority={vehicle.dispatch_priority} />}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            {vehicle.make} {vehicle.model}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <StatusBadge status={vehicle.status} />
      </div>
      {vehicle.vei_procedure && (
        <p className="mt-3 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Procédure VEI
        </p>
      )}
    </Link>
  );
}
