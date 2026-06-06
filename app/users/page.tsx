"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingPage } from "@/components/LoadingPage";
import { PageHeader } from "@/components/PageHeader";
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

  if (!user) return <LoadingPage />;

  return (
    <AppShell
      user={user}
      nav={[
        { href: "/dashboard", label: "Tableau de bord" },
        { href: "/users", label: "Utilisateurs" },
      ]}
    >
      <PageHeader
        title="Gestion utilisateurs"
        subtitle="Créer et gérer les comptes atelier"
      />

      <form onSubmit={saveUser} className="card-padded mb-8 space-y-4">
        <h2 className="section-title">
          {editing ? "Modifier utilisateur" : "Nouvel utilisateur"}
        </h2>
        <input
          placeholder="Nom complet"
          className="input-field"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            placeholder="Identifiant"
            className="input-field"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            placeholder="Mot de passe"
            type="password"
            className="input-field"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <select
          className="input-field"
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
            className="input-field"
            value={form.mechanic_slot}
            onChange={(e) => setForm({ ...form, mechanic_slot: e.target.value })}
          />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className="btn-primary-block sm:!w-auto">
            {editing ? "Mettre à jour" : "Créer"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({
                  full_name: "",
                  username: "",
                  password: "1234",
                  role: "mechanic",
                  mechanic_slot: "",
                });
              }}
              className="btn-secondary"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="card-padded flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900">
                {u.full_name}{" "}
                {!u.active && (
                  <span className="text-xs font-normal text-red-600">(inactif)</span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {u.username} · {ROLE_LABELS[u.role]}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
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
                className="btn-secondary !min-h-10 !px-3"
              >
                Modifier
              </button>
              {u.active && (
                <button
                  type="button"
                  onClick={() => deactivate(u)}
                  className="btn-danger !min-h-10 !px-3"
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
