import { VEI_STATUS_LABELS } from "@/lib/constants";
import { VEI_STATUSES, type VeiStatus } from "@/lib/manager-actions";

export function VeiStatusPicker({
  status,
  onChange,
  disabled,
  compact,
}: {
  status: string;
  onChange: (status: VeiStatus) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-1"}`}>
      {VEI_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled || s === status}
          onClick={() => onChange(s)}
          className={
            s === status ? "btn-chip-active !min-h-10 px-4" : "btn-chip-inactive !min-h-10 px-4"
          }
        >
          {VEI_STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
