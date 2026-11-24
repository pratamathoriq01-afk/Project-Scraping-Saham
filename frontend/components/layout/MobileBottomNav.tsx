"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bookmark,
  NotebookPen,
} from "lucide-react";
import { useWorkspaceStore, type NavTab } from "@/store/useWorkspaceStore";
import { cn } from "@/lib/utils";

const MOBILE_TABS: {
  id: NavTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "komparasi", label: "Komparasi", Icon: ArrowLeftRight },
  { id: "watchlist", label: "Watchlist", Icon: Bookmark },
  { id: "keuangan", label: "Keuangan", Icon: BarChart3 },
  { id: "jurnal", label: "Jurnal", Icon: NotebookPen },
];

export function MobileBottomNav() {
  const { activeTab, setActiveTab } = useWorkspaceStore();

  return (
    <nav
      aria-label="Navigasi bawah mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid h-[60px] max-w-md grid-cols-4 items-center px-2 pb-[env(safe-area-inset-bottom,0px)]">
        {MOBILE_TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg transition-colors",
                isActive ? "text-ink" : "text-ink-muted hover:text-ink-secondary"
              )}
            >
              <Icon
                className={cn("h-4 w-4", isActive ? "stroke-[2.25]" : "stroke-[1.75]")}
              />
              <span
                className={cn(
                  "text-xs leading-none",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
