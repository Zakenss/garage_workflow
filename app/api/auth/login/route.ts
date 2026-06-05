import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE, getRoleHome } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Identifiants requis" }, { status: 400 });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, full_name, username, password, role, mechanic_slot, active")
    .eq("username", username)
    .single();

  if (error || !user || !user.active) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  if (user.password !== password) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const session: SessionUser = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    mechanic_slot: user.mechanic_slot,
  };

  const response = NextResponse.json({
    user: session,
    redirect: getRoleHome(session.role),
  });

  response.cookies.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
