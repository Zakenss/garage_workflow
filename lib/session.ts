import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSession } from "./auth";
import type { SessionUser } from "./types";

export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(SESSION_COOKIE)?.value);
}
