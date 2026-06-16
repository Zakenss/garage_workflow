"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/Alert";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erreur de connexion");
        setLoading(false);
        return;
      }
      const to = searchParams.get("from") || data.redirect || "/";
      // Full navigation so the session cookie is picked up by the server layout.
      window.location.assign(to);
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200/10 bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Garage Workflow
          </h1>
          <p className="mt-1 text-sm text-slate-500">Connexion atelier</p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <label className="label-field">
          Identifiant
          <input
            className="input-field mt-1.5"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="ex. manager"
            required
          />
        </label>

        <label className="label-field mt-4 block">
          Mot de passe
          <input
            type="password"
            className="input-field mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary-block mt-6"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          Démo : manager / 1234 · secretary / 1234 · mechanic1 / 1234 · seller / 1234
        </p>
      </form>
    </div>
  );
}
