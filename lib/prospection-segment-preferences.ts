export type ProspectionSegmentPreference = {
  visible?: boolean;
  order?: number;
};

export type ProspectionSegmentPreferences = Record<string, ProspectionSegmentPreference>;

export const PROSPECTION_SEGMENT_PREFS_KEY = "gando.prospection.companySegments.v1";
export const PROSPECTION_SEGMENT_PREFS_EVENT = "gando:prospection-segments-changed";

export function readProspectionSegmentPreferences(): ProspectionSegmentPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROSPECTION_SEGMENT_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeProspectionSegmentPreferences(preferences: ProspectionSegmentPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROSPECTION_SEGMENT_PREFS_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(PROSPECTION_SEGMENT_PREFS_EVENT));
}

export function orderVisibleCompanySegments<T extends { listId: string; objectTypeId: string }>(segments: T[], preferences: ProspectionSegmentPreferences) {
  return segments
    .filter(segment => segment.objectTypeId === "0-2" && preferences[segment.listId]?.visible !== false)
    .map((segment, sourceIndex) => ({
      segment,
      order: preferences[segment.listId]?.order ?? 10_000 + sourceIndex,
    }))
    .sort((a, b) => a.order - b.order)
    .map(item => item.segment);
}
