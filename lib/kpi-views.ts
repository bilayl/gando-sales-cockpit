export const KPI_VIEWS = [
  "ceo",
  "growth",
  "economics",
  "forecast",
  "acquisition",
  "cash",
  "remuneration",
  "history",
  "data",
] as const;

export type KpiView = (typeof KPI_VIEWS)[number];

export const KPI_VIEW_META: Record<KpiView, { label: string; description: string }> = {
  ceo: { label: "Vue CEO", description: "Résultats clés et priorité du moment." },
  growth: { label: "Croissance", description: "Usage, fréquence et activation des loueurs." },
  economics: { label: "Économie & risque", description: "Marge, take rate et exposition au risque." },
  forecast: { label: "Prévisions", description: "Trajectoires et scénarios." },
  acquisition: { label: "Acquisition", description: "CAC, tests et efficacité commerciale." },
  cash: { label: "Cash", description: "Coûts, trésorerie et runway." },
  remuneration: { label: "Redevances", description: "Reversements loueurs et partenaires." },
  history: { label: "Historique", description: "Réel mois par mois." },
  data: { label: "Données", description: "Qualité et fiabilité des sources." },
};
