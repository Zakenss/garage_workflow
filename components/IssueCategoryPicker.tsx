"use client";

import {
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_COLORS,
  ISSUE_CATEGORY_LABELS,
  type IssueCategory,
} from "@/lib/constants";

export function IssueCategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: IssueCategory | null;
  onChange: (category: IssueCategory) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="label-field mb-2">Type de problème</p>
      <div className="flex flex-wrap gap-2">
        {ISSUE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            disabled={disabled}
            onClick={() => onChange(category)}
            className={value === category ? "btn-chip-active" : "btn-chip-inactive"}
          >
            {ISSUE_CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function IssueCategoryBadge({
  category,
}: {
  category: IssueCategory | null | undefined;
}) {
  if (!category) return null;
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${ISSUE_CATEGORY_COLORS[category]}`}
    >
      {ISSUE_CATEGORY_LABELS[category]}
    </span>
  );
}
