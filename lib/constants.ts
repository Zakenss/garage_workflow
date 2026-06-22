import type { UserRole, VehicleStatus } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  secretary: "Secrétaire",
  workshop_manager: "Chef d'atelier",
  mechanic: "Mécanicien",
  storekeeper: "Magasinier",
  bodyworker: "Carrossier",
  seller: "Vendeur",
  admin: "Administration",
};

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  arrived: "Arrivé",
  in_workshop: "En atelier",
  diagnostic_assigned: "Diagnostic assigné",
  diagnostic_complete: "Diagnostic terminé",
  parts_pending: "En attente pièces",
  validation_pending: "Validation technique",
  repair_in_progress: "Réparation en cours",
  repair_complete: "Réparation terminée",
  bodywork_assigned: "Carrosserie assignée",
  bodywork_in_progress: "Carrosserie en cours",
  bodywork_complete: "Carrosserie terminée",
  ready_to_sell: "Prêt à vendre",
  for_sale: "Mis en vente",
  reserved: "Réservé",
  sold: "Vendu",
};

export const STATUS_COLORS: Record<VehicleStatus, string> = {
  arrived: "bg-slate-200 text-slate-800",
  in_workshop: "bg-blue-100 text-blue-800",
  diagnostic_assigned: "bg-indigo-100 text-indigo-800",
  diagnostic_complete: "bg-purple-100 text-purple-800",
  parts_pending: "bg-amber-100 text-amber-900",
  validation_pending: "bg-orange-100 text-orange-900",
  repair_in_progress: "bg-yellow-100 text-yellow-900",
  repair_complete: "bg-lime-100 text-lime-900",
  bodywork_assigned: "bg-pink-100 text-pink-800",
  bodywork_in_progress: "bg-rose-100 text-rose-900",
  bodywork_complete: "bg-fuchsia-100 text-fuchsia-900",
  ready_to_sell: "bg-emerald-100 text-emerald-900",
  for_sale: "bg-green-100 text-green-900",
  reserved: "bg-cyan-100 text-cyan-900",
  sold: "bg-gray-300 text-gray-800",
};

export const ROLE_HOME: Record<UserRole, string> = {
  secretary: "/vehicles/arrivals",
  workshop_manager: "/dashboard",
  mechanic: "/vehicles/my",
  storekeeper: "/parts",
  bodyworker: "/bodywork",
  seller: "/vehicles/ready-sale",
  admin: "/dashboard",
};

export const VEI_STATUS_LABELS: Record<string, string> = {
  to_schedule: "À planifier",
  scheduled: "Planifié",
  completed: "Réalisé",
};

export const PART_STATUS_LABELS: Record<string, string> = {
  in_stock: "En stock",
  to_order: "À commander",
  ordered: "Commandée",
  to_repair: "À réparer",
  received: "Reçue",
  ready_for_mechanic: "Prête mécanicien",
};

export const PART_STATUSES = [
  "in_stock",
  "to_order",
  "ordered",
  "to_repair",
  "received",
  "ready_for_mechanic",
] as const;

export type PartStatus = (typeof PART_STATUSES)[number];

export const ISSUE_CATEGORIES = ["mechanical", "bodywork"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  mechanical: "Mécanique",
  bodywork: "Carrosserie",
};

export const ISSUE_CATEGORY_COLORS: Record<IssueCategory, string> = {
  mechanical: "bg-blue-100 text-blue-900",
  bodywork: "bg-violet-100 text-violet-900",
};

export const TIMELINE_LABELS: Record<string, string> = {
  vehicle_arrived: "Véhicule enregistré à l'arrivée",
  vehicle_updated: "Fiche véhicule modifiée",
  vehicle_deleted: "Véhicule supprimé",
  mechanic_assigned: "Mécanicien assigné",
  mechanic_reassigned: "Mécanicien changé",
  vei_status_change: "Statut VEI mis à jour",
  vei_updated: "Dossier VEI modifié",
  status_change: "Changement de statut",
  followup_repair_started: "Réparation complémentaire démarrée",
  part_sent_to_bodywork: "Pièce envoyée au carrossier",
  part_marked_replace: "Pièce à remplacer",
  parts_list_submitted: "Liste pièces soumise au chef d'atelier",
  parts_list_approved: "Liste pièces validée",
  parts_list_rejected: "Liste pièces refusée",
  part_received: "Pièce réceptionnée",
  part_ready_for_mechanic: "Pièce prête pour le mécanicien",
  repair_scheduled: "Réparation planifiée",
  vehicle_washed: "Véhicule marqué comme lavé",
  vehicle_wash_undone: "Lavage annulé",
  seller_expert_scheduled: "Rendez-vous expert planifié",
  seller_status_change: "Statut vente mis à jour",
  reconditioning_complete: "Reconditionnement terminé",
  repair_cost_report_generated: "Rapport coût réparation généré",
  repair_cost_report_regenerated: "Rapport coût réparation régénéré",
};

export const WORKFLOW_STEP_LABELS: Record<string, string> = {
  arrived: "Arrivé",
  in_workshop: "En atelier",
  diagnostic_assigned: "Diagnostic",
  parts_pending: "Pièces",
  repair_in_progress: "Réparation",
  repair_complete: "Réparation terminée",
  ready_to_sell: "Prêt à vendre",
  for_sale: "En vente",
  sold: "Vendu",
};
