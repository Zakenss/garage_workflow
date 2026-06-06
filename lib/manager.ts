import type { VehicleStatus } from "./types";

export const MANAGER_NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/workshop/reception", label: "Réception atelier" },
  { href: "/workshop/assign", label: "Dispatch atelier" },
] as const;

/** Waiting for mechanic assignment */
export const WORKSHOP_WAITING_STATUS: VehicleStatus = "in_workshop";

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
