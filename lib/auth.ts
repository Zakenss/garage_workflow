import type { SessionUser, UserRole } from "./types";
import { ROLE_HOME } from "./constants";

export const SESSION_COOKIE = "garage_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export function getRoleHome(role: UserRole): string {
  return ROLE_HOME[role];
}

export function parseSession(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SessionUser;
    if (!data?.id || !data?.role) return null;
    return data;
  } catch {
    return null;
  }
}

export function canAccess(role: UserRole, path: string): boolean {
  if (role === "admin") return true;
  if (path.startsWith("/login")) return true;

  const rules: Partial<Record<UserRole, string[]>> = {
    secretary: ["/vehicles/arrivals", "/vehicles/manage", "/vehicles/tracking", "/vehicles/"],
    workshop_manager: [
      "/dashboard",
      "/workshop/reception",
      "/workshop/assign",
      "/workshop/in-workshop",
      "/workshop/queue",
      "/workshop/termine",
      "/workshop/issues",
      "/workshop/vehicle",
      "/workshop/vei",
      "/parts",
      "/vehicles/tracking",
      "/vehicles/",
    ],
    mechanic: [
      "/vehicles/my",
      "/vehicles/checklist",
      "/vehicles/followup",
      "/vehicles/diagnostic",
      "/vehicles/repair",
      "/vehicles/tracking",
      "/vehicles/",
    ],
    storekeeper: ["/parts", "/vehicles/tracking", "/vehicles/"],
    bodyworker: ["/bodywork", "/vehicles/tracking", "/vehicles/"],
    seller: ["/vehicles/ready-sale", "/vehicles/"],
  };

  const allowed = rules[role] ?? [];
  return allowed.some((prefix) => path.startsWith(prefix));
}
