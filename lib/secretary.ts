export const SECRETARY_NAV = [
  { href: "/vehicles/arrivals", label: "Arrivées" },
  { href: "/vehicles/manage", label: "Gestion véhicules" },
  { href: "/vehicles/tracking", label: "Suivi véhicules" },
] as const;

/** Workflow steps shown on secretary progress view */
export const WORKFLOW_STEPS = [
  "arrived",
  "in_workshop",
  "diagnostic_assigned",
  "parts_pending",
  "repair_in_progress",
  "repair_complete",
  "ready_to_sell",
  "for_sale",
  "sold",
] as const;
