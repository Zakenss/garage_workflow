"use client";

import { PART_STATUS_LABELS, PART_STATUSES } from "@/lib/constants";

export function PartStatusPicker({
  status,
  disabled,
  onChange,
}: {
  status: string;
  disabled?: boolean;
  onChange: (status: (typeof PART_STATUSES)[number]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PART_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={status === s ? "btn-chip-active" : "btn-chip-inactive"}
        >
          {PART_STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
