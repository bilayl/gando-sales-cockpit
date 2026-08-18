export const POST_CALL_EMAIL_KINDS = [
  "post_demo",
  "pricing_info",
  "decision_maker_intro",
  "recap",
] as const;

export type PostCallEmailKind = (typeof POST_CALL_EMAIL_KINDS)[number];

export const POST_CALL_EMAIL_LABELS: Record<PostCallEmailKind, string> = {
  post_demo: "Relance post-démo",
  pricing_info: "Informations & tarifs",
  decision_maker_intro: "Premier contact gérant",
  recap: "Récap après appel",
};

export function isPostCallEmailKind(value: unknown): value is PostCallEmailKind {
  return typeof value === "string" && (POST_CALL_EMAIL_KINDS as readonly string[]).includes(value);
}
