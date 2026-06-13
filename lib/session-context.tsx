"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "./types";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionUser | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/**
 * Returns the current session user, provided synchronously by the root layout.
 * Avoids a per-navigation round-trip to /api/auth/session.
 */
export function useSession(): SessionUser | null {
  return useContext(SessionContext);
}
