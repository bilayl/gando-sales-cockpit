export type GandoBrandAsset = {
  id: string;
  name: string;
  description: string;
  fileName: string;
  preview: "light" | "dark" | "purple" | "petrol";
  svg: string;
};

const symbolPrimary = `
  <path d="M99.6699 83.1963C96.4012 89.9055 91.108 95.4201 84.5369 98.9624C77.9656 102.505 70.4477 103.896 63.0432 102.941C55.6385 101.985 48.7208 98.7306 43.2654 93.6363C37.8097 88.5419 34.0915 81.8646 32.635 74.5455C31.1784 67.2265 32.0569 59.6351 35.1466 52.8419C38.2363 46.0485 43.3815 40.3957 49.8565 36.6806C56.3315 32.9655 63.8099 31.3755 71.2372 32.1347C78.6645 32.8938 85.6661 35.9639 91.2547 40.9121L89.3163 43.0994C85.9245 46.9262 80.0632 47.0564 75.2247 45.3977C73.5413 44.8206 71.7883 44.4335 69.9976 44.2506C65.1082 43.7507 60.1853 44.7975 55.9227 47.2432C51.6603 49.6887 48.2731 53.4099 46.2393 57.882C44.2052 62.3541 43.6269 67.3515 44.5859 72.1694C45.5447 76.9876 47.9923 81.3832 51.5838 84.7369C55.1751 88.0905 59.729 90.2328 64.6034 90.8619C69.4778 91.4908 74.4269 90.5749 78.7526 88.2429C80.3369 87.389 81.8082 86.3607 83.1427 85.1836C86.9777 81.8007 92.4428 79.6788 97.0416 81.9171L99.6699 83.1963Z" />
  <path d="M62.0741 72.8299C68.7882 68.7533 76.9505 66.9623 85.0477 67.7889C91.1578 68.4126 96.9177 70.4947 101.732 73.7656C104.13 75.3953 103.524 78.5481 100.856 79.8108C97.2478 76.3078 90.2269 76.2804 85.3846 77.576C82.5513 78.5274 78.773 80.9772 75.7198 83.5915C73.3733 85.6007 69.6125 86.1538 67.2092 84.1973C62.9263 80.7101 57.7939 75.429 62.0741 72.8299Z" />`;

function symbolSvg(fill: string) {
  return `<svg width="134" height="134" viewBox="0 0 134 134" fill="none" xmlns="http://www.w3.org/2000/svg"><g fill="${fill}">${symbolPrimary}</g></svg>`;
}

function iconSvg(background: string, symbol = "#FFFFFF") {
  return `<svg width="134" height="134" viewBox="0 0 134 134" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="3.5" width="127" height="127" rx="30" fill="${background}"/><g fill="${symbol}">${symbolPrimary}</g></svg>`;
}

function horizontalSvg(markColor: string, textColor: string) {
  return `<svg width="470" height="134" viewBox="0 0 470 134" fill="none" xmlns="http://www.w3.org/2000/svg"><g fill="${markColor}">${symbolPrimary}</g><text x="145" y="89" fill="${textColor}" font-family="Bricolage Grotesque, DM Sans, Arial, sans-serif" font-size="67" font-weight="650" letter-spacing="-3">Gando</text></svg>`;
}

export const GANDO_BRAND_COLORS = [
  { name: "Pétrole", hex: "#004855", rgb: "0 · 72 · 85", role: "Fond fort, texte à fort contraste" },
  { name: "Citron", hex: "#D4F9C3", rgb: "212 · 249 · 195", role: "Accent clair et fonds secondaires" },
  { name: "Violet", hex: "#735DF3", rgb: "115 · 93 · 243", role: "Couleur de marque principale" },
  { name: "Lavande", hex: "#D6D0FB", rgb: "214 · 208 · 251", role: "Fond doux et accompagnement du violet" },
  { name: "Vert pomme", hex: "#00D776", rgb: "0 · 215 · 118", role: "Accent dynamique et signal positif" },
] as const;

export const GANDO_BRAND_CONTRASTS = [
  { foreground: "#004855", background: "#D4F9C3", label: "Pétrole / Citron", score: "8.81:1", level: "AAA texte" },
  { foreground: "#004855", background: "#D6D0FB", label: "Pétrole / Lavande", score: "6.91:1", level: "AA texte" },
  { foreground: "#004855", background: "#00D776", label: "Pétrole / Pomme", score: "5.33:1", level: "AA texte" },
  { foreground: "#735DF3", background: "#D6D0FB", label: "Violet / Lavande", score: "3.3:1", level: "Titres uniquement" },
  { foreground: "#00D776", background: "#D4F9C3", label: "Pomme / Citron", score: "1.65:1", level: "Décoratif uniquement" },
] as const;

export const GANDO_BRAND_ASSETS: GandoBrandAsset[] = [
  {
    id: "logo-primary",
    name: "Logo primaire · Pétrole",
    description: "Version partenaire par défaut sur fond clair.",
    fileName: "gando-logo-primary.svg",
    preview: "light",
    svg: horizontalSvg("#004855", "#004855"),
  },
  {
    id: "logo-violet",
    name: "Logo primaire · Violet",
    description: "Alternative de marque sur fond blanc ou très clair.",
    fileName: "gando-logo-violet.svg",
    preview: "light",
    svg: horizontalSvg("#735DF3", "#735DF3"),
  },
  {
    id: "logo-white",
    name: "Logo primaire · Blanc",
    description: "Version pour fonds pétrole, violet, photo ou très sombres.",
    fileName: "gando-logo-white.svg",
    preview: "petrol",
    svg: horizontalSvg("#FFFFFF", "#FFFFFF"),
  },
  {
    id: "symbol-petrol",
    name: "Symbole Gando · Pétrole",
    description: "Symbole seul pour espaces compacts et co-branding.",
    fileName: "gando-symbol-petrol.svg",
    preview: "light",
    svg: symbolSvg("#004855"),
  },
  {
    id: "symbol-violet",
    name: "Symbole Gando · Violet",
    description: "Symbole seul dans la couleur de marque principale.",
    fileName: "gando-symbol-violet.svg",
    preview: "light",
    svg: symbolSvg("#735DF3"),
  },
  {
    id: "symbol-white",
    name: "Symbole Gando · Blanc",
    description: "À utiliser sur un fond violet, pétrole ou sombre.",
    fileName: "gando-symbol-white.svg",
    preview: "purple",
    svg: symbolSvg("#FFFFFF"),
  },
  {
    id: "icon-petrol",
    name: "Icône responsive · Pétrole",
    description: "Version carrée arrondie pour interfaces, avatars et badges.",
    fileName: "gando-icon-petrol.svg",
    preview: "light",
    svg: iconSvg("#004855"),
  },
  {
    id: "icon-violet",
    name: "Icône responsive · Violet",
    description: "Version carrée arrondie dans la couleur principale.",
    fileName: "gando-icon-violet.svg",
    preview: "light",
    svg: iconSvg("#735DF3"),
  },
  {
    id: "icon-citron",
    name: "Icône responsive · Citron",
    description: "Version claire avec symbole pétrole.",
    fileName: "gando-icon-citron.svg",
    preview: "light",
    svg: iconSvg("#D4F9C3", "#004855"),
  },
];

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
