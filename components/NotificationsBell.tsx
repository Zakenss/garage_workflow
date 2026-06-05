"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Notification, SessionUser } from "@/lib/types";

export function NotificationsBell({ user }: { user: SessionUser }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},target_role.eq.${user.role}`)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notification[]) ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, user.role]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg border px-3 py-1.5 text-sm"
      >
        Notifications
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 max-h-80 w-80 overflow-auto rounded-xl border bg-white shadow-lg">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Aucune notification</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`block w-full border-b px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                  n.read ? "text-slate-500" : "font-medium text-slate-900"
                }`}
              >
                {n.message}
                <span className="mt-1 block text-xs text-slate-400">
                  {new Date(n.created_at).toLocaleString("fr-FR")}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
