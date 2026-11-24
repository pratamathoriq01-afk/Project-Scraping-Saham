"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

type ThemeChoice = "system" | "light" | "dark";

const THEME_OPTIONS: {
  value: ThemeChoice;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "system", label: "Auto (Sistem)", Icon: Monitor },
  { value: "light", label: "Light Mode", Icon: Sun },
  { value: "dark", label: "Dark Mode", Icon: Moon },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const currentTheme: ThemeChoice =
    isMounted && (theme === "light" || theme === "dark" || theme === "system")
      ? theme
      : "system";

  const cycleTheme = () => {
    const order: ThemeChoice[] = ["system", "light", "dark"];
    const nextIndex = (order.indexOf(currentTheme) + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const ActiveMobileIcon =
    currentTheme === "dark" ? Moon : currentTheme === "light" ? Sun : Monitor;

  return (
    <>
      {/* Desktop: 3-state segmented switcher (Auto / Light / Dark) */}
      <div
        role="group"
        aria-label="Pilih tema tampilan"
        className="hidden sm:inline-flex items-center rounded-lg border border-border-subtle bg-elevated p-0.5"
      >
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const isActive = isMounted && currentTheme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
                isActive
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>

      {/* Mobile: Compact 40px cycle button */}
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`Ganti tema (saat ini: ${currentTheme})`}
        title="Ganti tema (Auto / Light / Dark)"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface text-ink-secondary transition-colors hover:bg-elevated hover:text-ink sm:hidden"
      >
        <ActiveMobileIcon className="h-4 w-4" />
      </button>
    </>
  );
}
