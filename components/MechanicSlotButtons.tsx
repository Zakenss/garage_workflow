import type { User } from "@/lib/types";
import { MECHANIC_SLOTS, mechanicsBySlot } from "@/lib/manager-actions";

export function MechanicSlotButtons({
  mechanics,
  assignedMechanicId,
  busySlot,
  onAssign,
  disabled,
  label = "Assigner à",
}: {
  mechanics: User[];
  assignedMechanicId?: string | null;
  busySlot?: number | null;
  onAssign: (mechanicId: string, slot: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const bySlot = mechanicsBySlot(mechanics);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {MECHANIC_SLOTS.map((slot) => {
          const mechanic = bySlot[slot];
          const isAssigned = mechanic?.id === assignedMechanicId;
          const isBusy = busySlot === slot;
          const isDisabled = disabled || isBusy || !mechanic;

          return (
            <button
              key={slot}
              type="button"
              disabled={isDisabled}
              onClick={() => mechanic && onAssign(mechanic.id, slot)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                isAssigned
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]"
              }`}
              title={
                !mechanic
                  ? `Mécanicien ${slot} non configuré`
                  : isAssigned
                    ? `Actuellement assigné à ${mechanic.full_name}`
                    : `Assigner à ${mechanic.full_name}`
              }
            >
              <span>Mécan. {slot}</span>
              {mechanic && (
                <span
                  className={`mt-0.5 max-w-full truncate text-[10px] font-normal ${
                    isAssigned ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {mechanic.full_name.split(" ")[0]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
