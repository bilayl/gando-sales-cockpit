import { create } from "zustand";

type ProspectionState = {
  currentSessionId: string | null;
  selectedCompanyId: string | null;
  callMode: "idle" | "calling" | "post-call";
  currentLeadIndex: number;
  sessionStartedAt: string | null;
  setCurrentSessionId: (id: string | null) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setCallMode: (mode: ProspectionState["callMode"]) => void;
  setCurrentLeadIndex: (index: number) => void;
  startSession: (sessionId?: string | null) => void;
  resetSession: () => void;
};

export const useProspectionStore = create<ProspectionState>(set => ({
  currentSessionId: null,
  selectedCompanyId: null,
  callMode: "idle",
  currentLeadIndex: 0,
  sessionStartedAt: null,
  setCurrentSessionId: currentSessionId => set({ currentSessionId }),
  setSelectedCompanyId: selectedCompanyId => set({ selectedCompanyId }),
  setCallMode: callMode => set({ callMode }),
  setCurrentLeadIndex: currentLeadIndex => set({ currentLeadIndex }),
  startSession: currentSessionId => set({
    currentSessionId: currentSessionId ?? null,
    currentLeadIndex: 0,
    callMode: "idle",
    sessionStartedAt: new Date().toISOString(),
  }),
  resetSession: () => set({
    currentSessionId: null,
    selectedCompanyId: null,
    callMode: "idle",
    currentLeadIndex: 0,
    sessionStartedAt: null,
  }),
}));
