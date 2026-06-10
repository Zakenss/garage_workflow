import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import type { AssignmentHistoryRow } from "@/lib/workshop-vehicles";

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Terminée",
  cancelled: "Annulée",
};

export function AssignmentHistoryList({ rows }: { rows: AssignmentHistoryRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="card-padded">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link
                href={`/workshop/vehicle/${row.vehicles.id}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                {row.vehicles.license_plate}
              </Link>
              <p className="text-sm text-slate-600">
                {row.vehicles.make} {row.vehicles.model}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(row.created_at).toLocaleString("fr-FR")}
                {row.assigned_by_user &&
                  ` · Par ${row.assigned_by_user.full_name}`}
                {row.priority_order != null && ` · Priorité #${row.priority_order}`}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                Mécan. {row.mechanic.mechanic_slot ?? "?"} — {row.mechanic.full_name}
              </span>
              <span className="text-xs text-slate-500">
                {ASSIGNMENT_STATUS_LABELS[row.status] ?? row.status}
              </span>
              <StatusBadge status={row.vehicles.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
