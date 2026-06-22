"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Notification, SessionUser } from "@/lib/types";

export function NotificationsBell({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function openNotification(n: Notification) {
    await markRead(n.id);
    setOpen(false);
    if (n.vehicle_id && user.role === "bodyworker") {
      router.push("/bodywork");
      return;
    }
    if (n.vehicle_id && user.role === "seller") {
      router.push(`/vehicles/ready-sale?vehicle=${n.vehicle_id}`);
      return;
    }
    if (n.vehicle_id && user.role === "workshop_manager") {
      if (n.type === "repair_complete") {
        router.push(`/workshop/final/${n.vehicle_id}`);
        return;
      }
      if (n.type === "parts_list_pending_approval") {
        router.push("/workshop/parts-approval");
        return;
      }
      if (n.type === "parts_ready_for_scheduling") {
        router.push("/workshop/schedule");
        return;
      }
      router.push(`/vehicles/tracking?vehicle=${n.vehicle_id}`);
    }
    if (n.vehicle_id && user.role === "storekeeper") {
      if (n.type === "parts_list_approved" || n.type === "parts_list_rejected") {
        router.push("/parts");
        return;
      }
    }
    if (n.vehicle_id && user.role === "mechanic" && n.type === "repair_scheduled") {
      router.push("/vehicles/my");
      return;
    }
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-secondary relative !min-h-10"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unread > 0 ? `, ${unread} non lues` : ""}`}
      >
        <svg
          className="h-4 w-4 text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        <span className="hidden sm:inline">Notifications</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-2 max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg transition-all duration-200"
          role="menu"
        >
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Aucune notification</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotification(n)}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors duration-150 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${
                  n.read ? "text-slate-500" : "font-medium text-slate-900"
                }`}
                role="menuitem"
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
