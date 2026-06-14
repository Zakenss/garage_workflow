import type { VehicleStatus } from "./types";

export const MANAGER_NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/vehicles/tracking", label: "Suivi" },
  { href: "/workshop/queue", label: "Priorités" },
  { href: "/parts", label: "Photos et problèmes" },
] as const;

/** Waiting for mechanic assignment */
export const WORKSHOP_WAITING_STATUS: VehicleStatus = "in_workshop";

/** Repaired by mechanic, awaiting next workshop step */
export const WORKSHOP_REPAIR_COMPLETE_STATUS: VehicleStatus = "repair_complete";

/** Assigned to a mechanic, not yet completed */
export const WORKSHOP_ASSIGNED_STATUSES: VehicleStatus[] = [
  "diagnostic_assigned",
  "diagnostic_complete",
  "parts_pending",
  "validation_pending",
  "repair_in_progress",
];

/** All vehicles currently in the workshop pipeline */
export const WORKSHOP_ACTIVE_STATUSES: VehicleStatus[] = [
  WORKSHOP_WAITING_STATUS,
  ...WORKSHOP_ASSIGNED_STATUSES,
];
