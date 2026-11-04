/** Phone normalization shared by the CRM and the server; no silent +33 conversion for French overseas prefixes. */
export function normalizeWithAlloDialNumber(input: unknown): string | null {
  const trimmed = String(input ?? "").replace(/[\s().()-]/g, "");
  const candidate = trimmed.startsWith("00") ? "+" + trimmed.slice(2) : trimmed;
  if (/^\+[1-9]\d{7,14}$/.test(candidate)) return candidate;
  if (!/^0\d{9}$/.test(candidate)) return null;
  const overseas: Array<[string, string]> = [
    ["0590", "590"], ["0690", "590"], ["0691", "590"], // Guadeloupe
    ["0596", "596"], ["0696", "596"], ["0697", "596"], // Martinique
    ["0594", "594"], ["0694", "594"], // Guyane
    ["0262", "262"], ["0263", "262"], ["0692", "262"], ["0693", "262"], // Réunion
    ["0269", "262"], ["0639", "262"], // Mayotte
  ];
  const prefix = overseas.find(([local]) => candidate.startsWith(local));
  return "+" + (prefix?.[1] ?? "33") + candidate.slice(1);
}
