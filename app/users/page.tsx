"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/constants";
import type { SessionUser, User, UserRole } from "@/lib/types";

const ROLES: UserRole[] = [
  "secretary",
  "workshop_manager",
  "mechanic",
  "storekeeper",
  "bodyworker",
  "seller",
  "admin",
];

export default function UsersPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "1234",
    role: "mechanic" as UserRole,
    mechanic_slot: "",
  });
  const [editing, setEditing] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setUser(d.user));
  }, []);

  async function load() {
    const { data } = await supabase
      .from("users")
      .select("id, full_name, username, role, mechanic_slot, active, created_at")
      .order("full_name");
    setUsers((data as User[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      full_name: form.full_name,
      username: form.username,
      password: form.password,
      role: form.role,
      mechanic_slot: form.mechanic_slot ? parseInt(form.mechanic_slot, 10) : null,
      active: true,
    };
    if (editing) {
      await supabase.from("users").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("users").insert(payload);
    }
    setForm({
      full_name: "",
      username: "",
      password: "1234",
      role: "mechanic",
      mechanic_slot: "",
    });
    setEditing(null);
    load();
  }

  async function deactivate(u: User) {
    await supabase.from("users").update({ active: false }).eq("id", u.id);
    load();
  }

  if (!user) return <p className="p-6">Chargement…</p>;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/users", label: "Utilisateurs" },
      ]}
    >
      <h1 className="mb-6 text-2xl font-bold">Gestion utilisateurs</h1>

      <form
        onSubmit={saveUser}
        className="mb-8 space-y-3 rounded-xl border bg-white p-6"
      >
        <h2 className="font-semibold">
          {editing ? "Modifier utilisateur" : "Nouvel utilisateur"}
        </h2>
        <input
          placeholder="Nom complet"
          className="w-full rounded-lg border px-3 py-2"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <input
          placeholder="Identifiant"
          className="w-full rounded-lg border px-3 py-2"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <input
          placeholder="Mot de passe"
          type="password"
          className="w-full rounded-lg border px-3 py-2"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value as UserRole })
          }
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {form.role === "mechanic" && (
          <input
            placeholder="Slot mécanicien (1-3)"
            type="number"
            min={1}
            max={3}
            className="w-full rounded-lg border px-3 py-2"
            value={form.mechanic_slot}
            onChange={(e) => setForm({ ...form, mechanic_slot: e.target.value })}
          />
        )}
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-white"
        >
          {editing ? "Mettre à jour" : "Créer"}
        </button>
      </form>

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-4"
          >
            <div>
              <p className="font-medium">
                {u.full_name}{" "}
                {!u.active && (
                  <span className="text-xs text-red-600">(inactif)</span>
                )}
              </p>
              <p className="text-sm text-slate-500">
                {u.username} · {ROLE_LABELS[u.role]}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(u);
                  setForm({
                    full_name: u.full_name,
                    username: u.username,
                    password: "1234",
                    role: u.role,
                    mechanic_slot: u.mechanic_slot?.toString() ?? "",
                  });
                }}
                className="rounded border px-3 py-1 text-sm"
              >
                Modifier
              </button>
              {u.active && (
                <button
                  type="button"
                  onClick={() => deactivate(u)}
                  className="rounded border border-red-200 px-3 py-1 text-sm text-red-700"
                >
                  Désactiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
