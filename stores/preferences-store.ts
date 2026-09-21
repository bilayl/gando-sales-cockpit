"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Density = "comfortable" | "compact";

type PreferencesState = {
  density: Density;
  showSecondaryMetrics: boolean;
  setDensity: (density: Density) => void;
  setShowSecondaryMetrics: (show: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    set => ({
      density: "comfortable",
      showSecondaryMetrics: true,
      setDensity: density => set({ density }),
      setShowSecondaryMetrics: showSecondaryMetrics => set({ showSecondaryMetrics }),
    }),
    { name: "gando-cockpit-preferences" },
  ),
);
