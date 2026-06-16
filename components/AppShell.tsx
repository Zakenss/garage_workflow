"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";
import { dedupeNav, type NavItem } from "@/lib/nav-utils";

export type { NavItem };

export function AppShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navItems = dedupeNav(nav);

  function logout() {
    // Server redirect clears the session cookie and lands on /login in one step.
    window.location.href = "/api/auth/logout";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
              Garage Workflow
            </p>
            <p className="truncate text-xs text-slate-500">
              {user.full_name} · {ROLE_LABELS[user.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="btn-secondary shrink-0 !min-h-10 !px-3.5 !py-2 text-xs sm:text-sm"
          >
            Déconnexion
          </button>
        </div>
        <nav
          className="scrollbar-thin mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8"
          aria-label="Navigation principale"
        >
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-link-active" : "nav-link-inactive"}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
