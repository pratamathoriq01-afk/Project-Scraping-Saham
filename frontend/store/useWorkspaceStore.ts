import { create } from "zustand";

export type NavTab = "komparasi" | "watchlist" | "keuangan" | "jurnal";
export type StockModalMode = "add" | "swap";

interface WorkspaceUiState {
  isDrawerOpen: boolean;
  activeTab: NavTab;
  isStockModalOpen: boolean;
  stockModalMode: StockModalMode;
  swapTargetTicker: string | null;

  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  setActiveTab: (tab: NavTab) => void;
  openAddStockModal: () => void;
  openSwapStockModal: (targetTicker: string) => void;
  closeStockModal: () => void;
}

/**
 * UI Shell store strictly separated from financial stock domain state (useStockStore).
 */
export const useWorkspaceStore = create<WorkspaceUiState>((set) => ({
  isDrawerOpen: false,
  activeTab: "komparasi",
  isStockModalOpen: false,
  stockModalMode: "add",
  swapTargetTicker: null,

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),

  openAddStockModal: () =>
    set({
      isStockModalOpen: true,
      stockModalMode: "add",
      swapTargetTicker: null,
      isDrawerOpen: false,
    }),

  openSwapStockModal: (targetTicker) =>
    set({
      isStockModalOpen: true,
      stockModalMode: "swap",
      swapTargetTicker: targetTicker.toUpperCase(),
      isDrawerOpen: false,
    }),

  closeStockModal: () =>
    set({
      isStockModalOpen: false,
      swapTargetTicker: null,
    }),
}));
