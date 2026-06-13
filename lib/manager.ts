import type { VehicleStatus } from "./types";

export const MANAGER_NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/workshop/reception", label: "Réception" },
  { href: "/workshop/in-workshop", label: "Atelier" },
  { href: "/workshop/queue", label: "Priorités" },
  { href: "/parts", label: "Pièces & photos" },
  { href: "/parts/costs", label: "Coûts pièces" },
  { href: "/dashboard/supervision", label: "Supervision" },
  { href: "/workshop/issues", label: "Validation signalements" },
  { href: "/vehicles/tracking", label: "Suivi véhicules" },
  { href: "/workshop/termine", label: "Terminé" },
  { href: "/workshop/vei", label: "VEI" },
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
