"use client";

import { useState } from "react";
import { ChecklistIssueModal } from "@/components/ChecklistIssueModal";
import {
  addChecklistItem,
  countChecklistProgress,
  deleteChecklistItem,
  toggleChecklistItem,
  updateChecklistItemIssue,
  type ChecklistItemIssue,
  type ChecklistState,
} from "@/lib/reconditioning-checklist";

type IssueTarget = {
  sectionId: string;
  groupId: string;
  itemId: string;
  itemLabel: string;
};

export function ReconditioningChecklist({
  state,
  onChange,
  readOnly,
  enableIssues,
  issuePhotoPrefix,
}: {
  state: ChecklistState;
  onChange: (next: ChecklistState) => void;
  readOnly?: boolean;
  enableIssues?: boolean;
  issuePhotoPrefix?: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [issueTarget, setIssueTarget] = useState<IssueTarget | null>(null);
  const progress = countChecklistProgress(state);
  const pct =
    progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;

  function draftKey(sectionId: string, groupId: string) {
    return `${sectionId}::${groupId}`;
  }

  function findItemIssue(target: IssueTarget): ChecklistItemIssue | undefined {
    const sec = state.sections.find((s) => s.id === target.sectionId);
    const grp = sec?.groups.find((g) => g.id === target.groupId);
    return grp?.items.find((i) => i.id === target.itemId)?.issue;
  }

  function handleIssueSave(issue: ChecklistItemIssue) {
    if (!issueTarget) return;
    onChange(
      updateChecklistItemIssue(
        state,
        issueTarget.sectionId,
        issueTarget.groupId,
        issueTarget.itemId,
        issue
      )
    );
    setIssueTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="card-padded sticky top-0 z-10 border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Progression</p>
            <p className="text-xs text-slate-500">
              {progress.checked} / {progress.total} points cochés ({pct}%)
            </p>
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 sm:max-w-xs">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {state.sections.map((sec) => (
        <details key={sec.id} className="card-padded group" open>
          <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-slate-400 transition group-open:rotate-90">▸</span>
              {sec.title}
            </span>
          </summary>

          <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
            {sec.groups.map((grp) => (
              <div key={grp.id}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{grp.title}</h3>
                <ul className="space-y-1">
                  {grp.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                    >
                      <label className="checkbox-field min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={it.checked}
                          disabled={readOnly}
                          onChange={(e) =>
                            onChange(
                              toggleChecklistItem(
                                state,
                                sec.id,
                                grp.id,
                                it.id,
                                e.target.checked
                              )
                            )
                          }
                        />
                        <span
                          className={
                            it.checked ? "text-slate-500 line-through" : "text-slate-800"
                          }
                        >
                          {it.label}
                        </span>
                      </label>

                      {enableIssues && !readOnly && issuePhotoPrefix && (
                        <button
                          type="button"
                          onClick={() =>
                            setIssueTarget({
                              sectionId: sec.id,
                              groupId: grp.id,
                              itemId: it.id,
                              itemLabel: it.label,
                            })
                          }
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                            it.issue
                              ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title={
                            it.issue
                              ? "Modifier le signalement"
                              : "Signaler un problème"
                          }
                          aria-label={`Signaler un problème — ${it.label}`}
                        >
                          !
                        </button>
                      )}

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange(deleteChecklistItem(state, sec.id, grp.id, it.id))
                          }
                          className="btn-ghost shrink-0 !min-h-8 !px-2 text-xs text-red-600"
                          title="Supprimer"
                          aria-label={`Supprimer ${it.label}`}
                        >
                          Suppr.
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {!readOnly && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Ajouter un point…"
                      className="input-field flex-1 !min-h-9 text-sm"
                      value={drafts[draftKey(sec.id, grp.id)] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [draftKey(sec.id, grp.id)]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const key = draftKey(sec.id, grp.id);
                          const label = drafts[key] ?? "";
                          if (label.trim()) {
                            onChange(addChecklistItem(state, sec.id, grp.id, label));
                            setDrafts((d) => ({ ...d, [key]: "" }));
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-secondary !min-h-9 shrink-0 !px-3 text-sm"
                      onClick={() => {
                        const key = draftKey(sec.id, grp.id);
                        const label = drafts[key] ?? "";
                        if (label.trim()) {
                          onChange(addChecklistItem(state, sec.id, grp.id, label));
                          setDrafts((d) => ({ ...d, [key]: "" }));
                        }
                      }}
                    >
                      + Ajouter
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      ))}

      {issueTarget && issuePhotoPrefix && (
        <ChecklistIssueModal
          itemLabel={issueTarget.itemLabel}
          initialIssue={findItemIssue(issueTarget)}
          photoPrefix={`${issuePhotoPrefix}/issues/${issueTarget.itemId}`}
          onSave={handleIssueSave}
          onClose={() => setIssueTarget(null)}
        />
      )}
    </div>
  );
}
