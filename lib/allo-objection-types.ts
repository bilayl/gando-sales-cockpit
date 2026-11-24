export const OBJECTION_LABELS = {
  equipped: "Déjà équipé",
  price: "Prix / budget",
  previous_test: "Expérience passée / déjà testé",
  priority: "Pas une priorité",
  trust: "Confiance / garantie",
  integration: "Intégration / processus",
  decision: "Décision / validation interne",
  other: "Autres",
} as const;
export type ObjectionCategory = keyof typeof OBJECTION_LABELS;
export type Objection = {
  category: ObjectionCategory;
  quote: string;
  reply: string | null;
  outcome: "overcome" | "not_overcome" | "unknown";
  assessment: string;
  suggestion: string;
};
export type ObjectionCall = {
  id: string; title: string; date: string | null; member: string | null;
  truncated: boolean; objections: Objection[];
};
export type ObjectionReport = {
  calls: ObjectionCall[];
  accessible: number;
  selected: number;
  unavailable: number;
  invalid: number;
  historyLimited: boolean;
  model: string | null;
};
