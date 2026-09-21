"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveModal = "command" | "notifications" | null;

type UIState = {
  sidebarCollapsed: boolean;
  commandMenuOpen: boolean;
  activeModal: ActiveModal;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandMenuOpen: (open: boolean) => void;
  setActiveModal: (modal: ActiveModal) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandMenuOpen: false,
      activeModal: null,
      setSidebarCollapsed: sidebarCollapsed => set({ sidebarCollapsed }),
      setCommandMenuOpen: commandMenuOpen => set({ commandMenuOpen }),
      setActiveModal: activeModal => set({ activeModal }),
    }),
    {
      name: "gando-cockpit-ui",
      partialize: state => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
