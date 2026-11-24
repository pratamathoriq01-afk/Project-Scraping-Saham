"use client";

import * as React from "react";
import { TopHeader } from "@/components/layout/TopHeader";
import { HamburgerDrawer } from "@/components/layout/HamburgerDrawer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SmartStockModal } from "@/components/modal/SmartStockModal";
import { UrlStockSync } from "@/components/sync/UrlStockSync";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink transition-colors">
      <UrlStockSync />
      <TopHeader />
      <HamburgerDrawer />
      <SmartStockModal />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-12">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
