import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build") {
      return {
        url: "https://placeholder.supabase.co",
        key: "placeholder-key",
      };
    }
    if (!url || !key) {
      console.warn("Supabase env vars missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return {
      url: url ?? "https://placeholder.supabase.co",
      key: key ?? "placeholder-key",
    };
  }
  return { url, key };
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = getConfig();
    client = createClient(url, key);
  }
  return client;
}

/** @deprecated prefer getSupabase() — kept for simpler imports */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const sb = getSupabase();
    const value = sb[prop as keyof SupabaseClient];
    return typeof value === "function" ? value.bind(sb) : value;
  },
});

export function getPublicUrl(bucket: string, path: string) {
  const { data } = getSupabase().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
