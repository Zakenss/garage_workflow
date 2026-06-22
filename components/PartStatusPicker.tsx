"use client";

import { PART_STATUS_LABELS, PART_STATUSES, type PartStatus } from "@/lib/constants";

const STOREKEEPER_FLOW_STATUSES: PartStatus[] = [
  "in_stock",
  "to_order",
  "ordered",
  "to_repair",
];

export function PartStatusPicker({
  status,
  disabled,
  allowedStatuses,
  onChange,
}: {
  status: string;
  disabled?: boolean;
  allowedStatuses?: PartStatus[];
  onChange: (status: PartStatus) => void;
}) {
  const options = allowedStatuses ?? [...PART_STATUSES];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => (
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

export { STOREKEEPER_FLOW_STATUSES };
