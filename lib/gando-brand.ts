export type GandoBrandAsset = {
  id: string;
  name: string;
  description: string;
  fileName: string;
  preview: "light" | "dark" | "purple";
  svg: string;
};

const symbolPrimary = `
  <path d="M99.6699 83.1963C96.4012 89.9055 91.108 95.4201 84.5369 98.9624C77.9656 102.505 70.4477 103.896 63.0432 102.941C55.6385 101.985 48.7208 98.7306 43.2654 93.6363C37.8097 88.5419 34.0915 81.8646 32.635 74.5455C31.1784 67.2265 32.0569 59.6351 35.1466 52.8419C38.2363 46.0485 43.3815 40.3957 49.8565 36.6806C56.3315 32.9655 63.8099 31.3755 71.2372 32.1347C78.6645 32.8938 85.6661 35.9639 91.2547 40.9121L89.3163 43.0994C85.9245 46.9262 80.0632 47.0564 75.2247 45.3977C73.5413 44.8206 71.7883 44.4335 69.9976 44.2506C65.1082 43.7507 60.1853 44.7975 55.9227 47.2432C51.6603 49.6887 48.2731 53.4099 46.2393 57.882C44.2052 62.3541 43.6269 67.3515 44.5859 72.1694C45.5447 76.9876 47.9923 81.3832 51.5838 84.7369C55.1751 88.0905 59.729 90.2328 64.6034 90.8619C69.4778 91.4908 74.4269 90.5749 78.7526 88.2429C80.3369 87.389 81.8082 86.3607 83.1427 85.1836C86.9777 81.8007 92.4428 79.6788 97.0416 81.9171L99.6699 83.1963Z" />
  <path d="M62.0741 72.8299C68.7882 68.7533 76.9505 66.9623 85.0477 67.7889C91.1578 68.4126 96.9177 70.4947 101.732 73.7656C104.13 75.3953 103.524 78.5481 100.856 79.8108C97.2478 76.3078 90.2269 76.2804 85.3846 77.576C82.5513 78.5274 78.773 80.9772 75.7198 83.5915C73.3733 85.6007 69.6125 86.1538 67.2092 84.1973C62.9263 80.7101 57.7939 75.429 62.0741 72.8299Z" />`;

function symbolSvg(fill: string) {
  return `<svg width="134" height="134" viewBox="0 0 134 134" fill="none" xmlns="http://www.w3.org/2000/svg"><g fill="${fill}">${symbolPrimary}</g></svg>`;
}

function iconSvg(background: string) {
  return `<svg width="134" height="134" viewBox="0 0 134 134" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="3.5" width="127" height="127" rx="63.5" fill="${background}"/><rect x="3.5" y="3.5" width="127" height="127" rx="63.5" stroke="white" stroke-width="7"/><g fill="white">${symbolPrimary}</g></svg>`;
}

function horizontalSvg(markColor: string, textColor: string) {
  return `<svg width="430" height="134" viewBox="0 0 430 134" fill="none" xmlns="http://www.w3.org/2000/svg"><g fill="${markColor}">${symbolPrimary}</g><text x="145" y="88" fill="${textColor}" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="700" letter-spacing="-2">gando</text></svg>`;
}

export const GANDO_BRAND_COLORS = [
  { name: "Gando Violet", hex: "#735DF3", role: "Couleur principale" },
  { name: "Gando Ink", hex: "#1B1F23", role: "Texte et logo sombre" },
  { name: "Black", hex: "#111111", role: "Contraste fort" },
  { name: "White", hex: "#FFFFFF", role: "Logo sur fond sombre" },
  { name: "Soft background", hex: "#FAFAFA", role: "Fond clair" },
] as const;

export const GANDO_BRAND_ASSETS: GandoBrandAsset[] = [
  {
    id: "symbol-violet",
    name: "Symbole Gando · Violet",
    description: "Version principale du symbole sur fond clair.",
    fileName: "gando-symbol-violet.svg",
    preview: "light",
    svg: symbolSvg("#735DF3"),
  },
  {
    id: "symbol-white",
    name: "Symbole Gando · Blanc",
    description: "À utiliser sur un fond violet ou sombre.",
    fileName: "gando-symbol-white.svg",
    preview: "purple",
    svg: symbolSvg("#FFFFFF"),
  },
  {
    id: "icon-violet",
    name: "Icône Gando · Violet",
    description: "Icône ronde pour interfaces, avatars et co-branding.",
    fileName: "gando-icon-violet.svg",
    preview: "light",
    svg: iconSvg("#735DF3"),
  },
  {
    id: "icon-dark",
    name: "Icône Gando · Sombre",
    description: "Alternative monochrome sombre.",
    fileName: "gando-icon-dark.svg",
    preview: "light",
    svg: iconSvg("#323232"),
  },
  {
    id: "logo-horizontal",
    name: "Logo Gando · Horizontal",
    description: "Version partenaire par défaut sur fond clair.",
    fileName: "gando-logo-horizontal.svg",
    preview: "light",
    svg: horizontalSvg("#735DF3", "#1B1F23"),
  },
  {
    id: "logo-horizontal-white",
    name: "Logo Gando · Horizontal blanc",
    description: "Version pour fonds violet, photo ou fond très sombre.",
    fileName: "gando-logo-horizontal-white.svg",
    preview: "dark",
    svg: horizontalSvg("#FFFFFF", "#FFFFFF"),
  },
];

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
