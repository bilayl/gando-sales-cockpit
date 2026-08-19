"use client";

type Recommendation = {
  id: string;
  title: string;
  subtitle?: string;
  phone?: string | null;
  priorityLabel: string;
  reason: string;
  suggestion: string;
};

type Props = {
  title?: string;
  items: Recommendation[];
  onOpen: (id: string) => void;
  emptyLabel?: string;
};

/**
 * Deprecated: call suggestions are now a persistent database-backed system segment
 * in the Contacts prospection workspace. Kept temporarily to avoid breaking older
 * company-view imports while the UI migrates away from the previous visual strip.
 */
export function CallRecommendationStrip(_props: Props) {
  return null;
}
