"use client";

import { create } from "zustand";

type ProspectionState = {
  currentSessionId: string | null;
  selectedCompanyId: string | null;
  callMode: "idle" | "session";
  currentLeadIndex: number;
  sessionStartedAt: string | null;
  startSession: (sessionId?: string) => void;
  stopSession: () => void;
  selectCompany: (id: string | null) => void;
  setCurrentLeadIndex: (index: number) => void;
};

export const useProspectionStore = create<ProspectionState>(set => ({
  currentSessionId: null,
  selectedCompanyId: null,
  callMode: "idle",
  currentLeadIndex: 0,
  sessionStartedAt: null,
  startSession: currentSessionId => set({
    currentSessionId: currentSessionId ?? crypto.randomUUID(),
    callMode: "session",
    currentLeadIndex: 0,
    sessionStartedAt: new Date().toISOString(),
  }),
  stopSession: () => set({
    currentSessionId: null,
    selectedCompanyId: null,
    callMode: "idle",
    currentLeadIndex: 0,
    sessionStartedAt: null,
  }),
  selectCompany: selectedCompanyId => set({ selectedCompanyId }),
  setCurrentLeadIndex: currentLeadIndex => set({ currentLeadIndex }),
}));
