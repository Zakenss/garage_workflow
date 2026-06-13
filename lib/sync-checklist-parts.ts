import type { ChecklistState } from "./reconditioning-checklist";
import { supabase } from "./supabase";

export type ChecklistPartNotes = {
  checklistItemId: string;
  problem?: string;
};

export function isPartsNeededText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return !/^aucune?s?$/i.test(t);
}

export function parsePartNotes(raw: string | null | undefined): ChecklistPartNotes | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChecklistPartNotes;
    if (parsed?.checklistItemId) return parsed;
  } catch {
    /* legacy plain notes */
  }
  if (raw.startsWith("checklist_item:")) {
    return { checklistItemId: raw.replace("checklist_item:", "") };
  }
  return null;
}

export function collectChecklistPartRequests(state: ChecklistState) {
  const items: Array<{
    itemId: string;
    itemLabel: string;
    partsNeeded: string;
    problem: string;
    photoPaths: string[];
  }> = [];

  for (const sec of state.sections) {
    for (const grp of sec.groups) {
      for (const item of grp.items) {
        if (!item.issue || !isPartsNeededText(item.issue.partsNeeded)) continue;
        items.push({
          itemId: item.id,
          itemLabel: item.label,
          partsNeeded: item.issue.partsNeeded.trim(),
          problem: item.issue.problem,
          photoPaths: item.issue.photoPaths ?? [],
        });
      }
    }
  }
  return items;
}

export async function syncChecklistPartsToDb(
  vehicleId: string,
  diagnosticId: string,
  state: ChecklistState
) {
  const requests = collectChecklistPartRequests(state);
  const activeItemIds = new Set<string>();

  const { data: existingParts } = await supabase
    .from("parts")
    .select("id, notes")
    .eq("vehicle_id", vehicleId);

  function findExistingPartId(itemId: string): string | undefined {
    return existingParts?.find(
      (p) => parsePartNotes(p.notes)?.checklistItemId === itemId
    )?.id;
  }

  for (const req of requests) {
    activeItemIds.add(req.itemId);
    const notes = JSON.stringify({
      checklistItemId: req.itemId,
      problem: req.problem,
    } satisfies ChecklistPartNotes);
    const part_name = `[${req.itemLabel}] ${req.partsNeeded}`;
    const photo_path = req.photoPaths[0] ?? null;
    const existingId = findExistingPartId(req.itemId);

    if (existingId) {
      await supabase
        .from("parts")
        .update({ part_name, photo_path, diagnostic_id: diagnosticId, notes })
        .eq("id", existingId);
    } else {
      await supabase.from("parts").insert({
        vehicle_id: vehicleId,
        diagnostic_id: diagnosticId,
        part_name,
        quantity: 1,
        status: "to_order",
        notes,
        photo_path,
      });
    }
  }

  for (const row of existingParts ?? []) {
    const meta = parsePartNotes(row.notes);
    if (meta && !activeItemIds.has(meta.checklistItemId)) {
      await supabase.from("parts").delete().eq("id", row.id);
    }
  }
}
