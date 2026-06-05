import type { SessionUser, UserRole } from "./types";
import { ROLE_HOME } from "./constants";

export const SESSION_COOKIE = "garage_session";

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
    secretary: ["/vehicles/arrivals", "/vehicles/"],
    workshop_manager: [
      "/dashboard",
      "/vehicles",
      "/workshop",
      "/users",
    ],
    mechanic: ["/vehicles/my", "/vehicles/diagnostic", "/vehicles/repair"],
    storekeeper: ["/parts"],
    bodyworker: ["/bodywork"],
    seller: ["/vehicles/ready-sale", "/vehicles/"],
  };

  const allowed = rules[role] ?? [];
  return allowed.some((prefix) => path.startsWith(prefix));
}
