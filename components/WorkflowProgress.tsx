import { WORKFLOW_STEP_LABELS } from "@/lib/constants";
import { WORKFLOW_STEPS } from "@/lib/secretary";
import type { VehicleStatus } from "@/lib/types";

const STATUS_RANK: Record<string, number> = Object.fromEntries(
  WORKFLOW_STEPS.map((s, i) => [s, i])
);

function resolveStep(status: VehicleStatus): number {
  if (status === "diagnostic_complete" || status === "validation_pending") {
    return STATUS_RANK.parts_pending ?? 3;
  }
  if (
    status === "bodywork_assigned" ||
    status === "bodywork_in_progress" ||
    status === "bodywork_complete"
  ) {
    return STATUS_RANK.repair_complete ?? 5;
  }
  if (status === "reserved") return STATUS_RANK.for_sale ?? 7;
  return STATUS_RANK[status] ?? 0;
}

export function WorkflowProgress({ status }: { status: VehicleStatus }) {
  const current = resolveStep(status);

  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-max gap-1">
        {WORKFLOW_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step}
              className={`flex flex-col items-center px-2 text-center ${
                active ? "opacity-100" : done ? "opacity-80" : "opacity-40"
              }`}
            >
              <span
                className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-slate-900 text-white"
                    : done
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span className="max-w-[4.5rem] text-[10px] leading-tight text-slate-600 sm:max-w-none sm:text-xs">
                {WORKFLOW_STEP_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
