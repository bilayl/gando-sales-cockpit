import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  sidebarOpen: boolean;
  commandMenuOpen: boolean;
  activeModal: string | null;
  setSidebarOpen: (open: boolean) => void;
  setCommandMenuOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      sidebarOpen: true,
      commandMenuOpen: false,
      activeModal: null,
      setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
      setCommandMenuOpen: commandMenuOpen => set({ commandMenuOpen }),
      setActiveModal: activeModal => set({ activeModal }),
    }),
    {
      name: "gando-cockpit-ui",
      partialize: state => ({ sidebarOpen: state.sidebarOpen }),
    },
  ),
);
