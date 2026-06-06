import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { VehicleStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium leading-none ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
