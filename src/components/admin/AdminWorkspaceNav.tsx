"use client";

import { CalendarDays, DatabaseBackup, LayoutDashboard, Megaphone, Trash2, Wallet } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { AdminView } from "@/types/admin/adminWorkspace";

const items = [
  { value: "queue", label: "Manage bookings", icon: LayoutDashboard },
  { value: "schedule", label: "Court schedule", icon: CalendarDays },
  { value: "announcements", label: "Announcements", icon: Megaphone },
  { value: "expenses", label: "Expenses & profit", icon: Wallet },
  { value: "backup", label: "Backup & restore", icon: DatabaseBackup },
  { value: "reset", label: "Reset data", icon: Trash2 },
] as const;

export function AdminWorkspaceNav({
  view,
  onSelect,
}: {
  view: AdminView;
  onSelect: (view: AdminView) => void;
}) {
  return (
    <aside className="modern-admin-nav">
      <div className="modern-admin-brand">
        <BrandLogo className="mx-auto w-32" />
        <p className="mt-5 text-center text-xs uppercase tracking-[0.12em] text-zinc-400">Admin</p>
      </div>
      <nav aria-label="Admin workspace">
        {items.map(item => (
          <button
            key={item.value}
            type="button"
            aria-current={view === item.value ? "page" : undefined}
            className={view === item.value ? "is-active" : ""}
            onClick={() => onSelect(item.value)}
          >
            <item.icon size={17} strokeWidth={1.6} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
