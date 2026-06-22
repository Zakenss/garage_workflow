import type { UserRole } from "./types";
import { MANAGER_NAV } from "./manager";
import { SECRETARY_NAV } from "./secretary";
import { STOREKEEPER_NAV } from "./storekeeper";

export const ADMIN_NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/parts", label: "Photos et problèmes" },
  { href: "/dashboard/supervision", label: "Supervision" },
  { href: "/parts/costs", label: "Coûts pièces" },
  { href: "/vehicles/repair-reports", label: "Rapports réparation" },
  { href: "/users", label: "Utilisateurs" },
] as const;

export const TRACKING_LINK = { href: "/vehicles/tracking", label: "Suivi véhicules" } as const;

export const MECHANIC_NAV = [
  { href: "/vehicles/my", label: "Mon planning" },
  { href: "/vehicles/followup", label: "Signalements" },
  TRACKING_LINK,
] as const;

export const BODYWORKER_NAV = [
  { href: "/bodywork", label: "Carrosserie" },
  TRACKING_LINK,
] as const;

export const SELLER_NAV = [
  { href: "/vehicles/ready-sale", label: "Préparation vente" },
  TRACKING_LINK,
] as const;

export type NavItem = { href: string; label: string };

export function navForRole(role: UserRole, extra: NavItem[] = []): NavItem[] {
  const base: NavItem[] = (() => {
    switch (role) {
      case "secretary":
        return [...SECRETARY_NAV];
      case "workshop_manager":
        return [...MANAGER_NAV];
      case "admin":
        return [...ADMIN_NAV];
      case "storekeeper":
        return [...STOREKEEPER_NAV];
      case "mechanic":
        return [...MECHANIC_NAV];
      case "bodyworker":
        return [...BODYWORKER_NAV];
      case "seller":
        return [...SELLER_NAV];
      default:
        return [TRACKING_LINK];
    }
  })();
  return [...base, ...extra];
}
