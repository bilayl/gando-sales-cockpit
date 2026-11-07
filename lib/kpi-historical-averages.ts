/**
 * Historical metrics are computed from the same monthly rows as /api/kpi.
 * A null value means "unknown", whereas zero is a genuine known zero.
 * Ratios use matched months and are calculated from aggregate numerator /
 * denominator, never as an unweighted mean of monthly percentages.
 */
export type HistoricalRawMonth = {
  year: number;
  monthNumber: number;
  revenue?: number | null;
  tdv?: number | null;
  deposits?: number | null;
  activeRenters?: number | null;
  depositCashouts?: number | null;
  cashoutAmount?: number | null;
  advancedGuarantee?: number | null;
};

export type HistoricalMetricId =
  | "mau" | "depositsPerMau" | "arpu" | "averageDeposit"
  | "takeRate" | "cashoutRate" | "guaranteeShare" | "averageCashout";

export type HistoricalMetric = {
  id: HistoricalMetricId;
  title: string;
  value: number | null;
  unit: "integer" | "decimal" | "euro" | "percent";
  months: number;
  numerator: number | null;
  denominator: number | null;
  formula: string;
  explanation: string;
};

export type HistoricalMonth = Required<HistoricalRawMonth> & {
  key: string;
  depositsPerMau: number | null;
  arpu: number | null;
  averageDeposit: number | null;
  takeRate: number | null;
  cashoutRate: number | null;
  guaranteeShare: number | null;
  averageCashout: number | null;
};

export type HistoricalReport = {
  from: string | null;
  to: string | null;
  monthsCovered: number;
  monthsInRange: number;
  excludedFutureMonths: number;
  metrics: HistoricalMetric[];
  months: HistoricalMonth[];
};

const VALID_FIELDS: Array<keyof Omit<HistoricalRawMonth, "year" | "monthNumber">> = [
  "revenue", "tdv", "deposits", "activeRenters", "depositCashouts",
  "cashoutAmount", "advancedGuarantee",
];
const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const ratio = (top: number | null, bottom: number | null) =>
  top != null && bottom != null && bottom > 0 ? top / bottom : null;
const monthKey = (row: { year: number; monthNumber: number }) =>
  String(row.year) + "-" + String(row.monthNumber).padStart(2, "0");

function currentMonthParis(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return value.year + "-" + value.month;
}

export function buildKpiHistoricalReport(
  input: HistoricalRawMonth[],
  now: Date = new Date(),
): HistoricalReport {
  const currentMonth = currentMonthParis(now);
  let excludedFutureMonths = 0;
  const byMonth = new Map<string, HistoricalMonth>();

  for (const row of input) {
    if (!Number.isInteger(row.year) || !Number.isInteger(row.monthNumber)
      || row.year < 2020 || row.year > 2100 || row.monthNumber < 1 || row.monthNumber > 12) continue;
    const key = monthKey(row);
    if (key > currentMonth) {
      excludedFutureMonths += 1;
      continue;
    }
    if (!VALID_FIELDS.some(field => number(row[field]) !== null)) continue;

    const normalized = Object.fromEntries(
      VALID_FIELDS.map(field => [field, number(row[field])]),
    ) as Record<typeof VALID_FIELDS[number], number | null>;
    const mau = normalized.activeRenters;
    const deposits = normalized.deposits;
    const revenue = normalized.revenue;
    const tdv = normalized.tdv;
    const captures = normalized.depositCashouts;
    const cashouts = normalized.cashoutAmount;
    const guarantees = normalized.advancedGuarantee;

    byMonth.set(key, {
      year: row.year, monthNumber: row.monthNumber, key,
      ...normalized,
      depositsPerMau: ratio(deposits, mau),
      arpu: ratio(revenue, mau),
      averageDeposit: ratio(tdv, deposits),
      takeRate: ratio(revenue, tdv),
      cashoutRate: ratio(captures, deposits),
      guaranteeShare: ratio(guarantees, cashouts),
      averageCashout: ratio(cashouts, captures),
    });
  }

  const months = [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));
  const first = months[0]?.key ?? null;
  const last = months.at(-1)?.key ?? null;
  const monthsInRange = first && last
    ? (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12
      + Number(last.slice(5)) - Number(first.slice(5)) + 1
    : 0;

  function weighted(
    top: keyof HistoricalRawMonth,
    bottom: keyof HistoricalRawMonth,
  ): { value: number | null; months: number; numerator: number | null; denominator: number | null } {
    const matched = months.filter(row => {
      const a = number(row[top]);
      const b = number(row[bottom]);
      return a !== null && b !== null && b > 0;
    });
    const numerator = matched.reduce((acc, row) => acc + (number(row[top]) || 0), 0);
    const denominator = matched.reduce((acc, row) => acc + (number(row[bottom]) || 0), 0);
    return {
      value: matched.length ? ratio(numerator, denominator) : null,
      months: matched.length,
      numerator: matched.length ? numerator : null,
      denominator: matched.length ? denominator : null,
    };
  }

  const mauMonths = months.filter(row => row.activeRenters !== null);
  const mauTotal = mauMonths.reduce((acc, row) => acc + (row.activeRenters || 0), 0);

  const metrics: HistoricalMetric[] = [
    {
      id: "mau", title: "MAU moyen", unit: "decimal",
      value: mauMonths.length ? mauTotal / mauMonths.length : null,
      months: mauMonths.length, numerator: mauMonths.length ? mauTotal : null,
      denominator: mauMonths.length || null,
      formula: "Σ loueurs actifs mensuels / nombre de mois MAU renseignés",
      explanation: "Nombre moyen de loueurs actifs par mois, et non nombre de loueurs uniques depuis le lancement.",
    },
    {
      id: "depositsPerMau", title: "Cautions / MAU", unit: "decimal",
      ...weighted("deposits", "activeRenters"),
      formula: "Σ cautions activées / Σ MAU sur les mêmes mois",
      explanation: "Fréquence d’utilisation pondérée par le nombre de loueurs actifs ; les mois sans MAU exploitable sont écartés.",
    },
    {
      id: "arpu", title: "ARPU historique", unit: "euro",
      ...weighted("revenue", "activeRenters"),
      formula: "Σ chiffre d’affaires Gando / Σ MAU sur les mêmes mois",
      explanation: "Revenu moyen par loueur actif et par mois, pondéré par le MAU.",
    },
    {
      id: "averageDeposit", title: "Caution moyenne", unit: "euro",
      ...weighted("tdv", "deposits"),
      formula: "Σ montants de cautions activées (TDV) / Σ cautions activées",
      explanation: "Montant sécurisé moyen par caution, calculé sur les mois où TDV et nombre de cautions sont connus.",
    },
    {
      id: "takeRate", title: "Take rate historique", unit: "percent",
      ...weighted("revenue", "tdv"),
      formula: "Σ chiffre d’affaires Gando / Σ TDV sur les mêmes mois",
      explanation: "Part du volume de cautions transformée en chiffre d’affaires ; ratio pondéré, non moyenne simple des taux mensuels.",
    },
    {
      id: "cashoutRate", title: "Taux d’encaissement", unit: "percent",
      ...weighted("depositCashouts", "deposits"),
      formula: "Σ captures payées / Σ cautions activées sur les mêmes mois",
      explanation: "Ratio d’opérations de capture payées sur les cautions activées. Les dates d’encaissement et d’activation peuvent différer ; ce n’est pas un taux de cautions distinctes encaissées.",
    },
    {
      id: "guaranteeShare", title: "Taux de garantie", unit: "percent",
      ...weighted("advancedGuarantee", "cashoutAmount"),
      formula: "Σ montants d’avances garanties acceptées / Σ montants encaissés sur les mêmes mois",
      explanation: "Part en montant des avances de garantie par rapport aux encaissements. Ce n’est pas le taux de cautions assurées ou acceptées par l’assureur.",
    },
    {
      id: "averageCashout", title: "Montant moyen encaissé", unit: "euro",
      ...weighted("cashoutAmount", "depositCashouts"),
      formula: "Σ montants encaissés / Σ opérations de capture payées",
      explanation: "Montant moyen par opération de capture payée, sur les mois où le nombre et le montant sont connus.",
    },
  ];

  return {
    from: first, to: last,
    monthsCovered: months.length,
    monthsInRange,
    excludedFutureMonths,
    metrics,
    months,
  };
}
