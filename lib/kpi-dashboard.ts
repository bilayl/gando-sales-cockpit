export type CoreKpiRow = {
  year: number
  monthNumber: number
  month?: string
  revenue: number | null
  tdv: number | null
  deposits: number | null
  activeRenters: number | null
  newUsers: number | null
  registeredUsers: number | null
  totalClients: number | null
  depositCashouts: number | null
  cashoutAmount: number | null
  advancedGuarantee: number | null
  churnedRenters: number | null
}

export type ValueKpiRow = {
  year: number
  monthNumber: number
  prospectsContacted: number | null
  meetings: number | null
  rentersActivated: number | null
  firstDepositRenters: number | null
  paidSpend: number | null
  salesCost: number | null
  signedRevenue: number | null
  cashCollected: number | null
  netMargin: number | null
}

export type CampaignKpiRow = {
  year: number
  monthNumber: number
  spend: number | null
  leads: number | null
  clients: number | null
  signedRevenue: number | null
  cashCollected: number | null
}

export type KpiMonthlyPoint = {
  key: string
  label: string
  year: number
  monthNumber: number
  revenue: number
  tdv: number
  deposits: number
  activeRenters: number
  takeRate: number | null
  arpu: number | null
  avgDeposit: number | null
  revenueGrowth: number | null
  depositGrowth: number | null
}

export type KpiDashboardSummary = {
  firstLabel: string
  lastLabel: string
  spanMonths: number
  totalRevenue: number
  totalTdv: number
  totalDeposits: number
  currentMau: number | null
  weightedTakeRate: number | null
  weightedArpu: number | null
  avgDeposit: number | null
  revenueGrowth: number | null
  tdvGrowth: number | null
  depositGrowth: number | null
  mauGrowth: number | null
  prospects: number
  meetings: number
  rentersActivated: number
  firstDepositRenters: number
  closingRate: number | null
  signedRevenue: number
  cashCollected: number
  collectionRate: number | null
  netMargin: number
  marginRate: number | null
  campaignSpend: number
  campaignCash: number
  cashRoas: number | null
  coverage: {
    revenue: number
    tdv: number
    deposits: number
    activeRenters: number
    total: number
  }
  points: KpiMonthlyPoint[]
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function known(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function ratio(top: number, bottom: number) {
  return bottom > 0 ? top / bottom : null
}

function key(year: number, monthNumber: number) {
  return year * 12 + monthNumber - 1
}

function label(year: number, monthNumber: number) {
  return `${MONTHS[monthNumber - 1]} ${String(year).slice(-2)}`
}

function growth(current: number | null | undefined, previous: number | null | undefined) {
  if (!known(current) || !known(previous) || previous === 0) return null
  return current / previous - 1
}

function geometricMonthlyGrowth(first: number | null | undefined, last: number | null | undefined, periods: number) {
  if (!known(first) || !known(last) || first <= 0 || last < 0 || periods <= 0) return null
  return Math.pow(last / first, 1 / periods) - 1
}

export function buildKpiDashboardSummary(
  coreRows: CoreKpiRow[],
  valueRows: ValueKpiRow[],
  campaignRows: CampaignKpiRow[],
): KpiDashboardSummary | null {
  const core = [...coreRows]
    .filter(row => [row.revenue, row.tdv, row.deposits, row.activeRenters].some(known))
    .sort((a, b) => key(a.year, a.monthNumber) - key(b.year, b.monthNumber))

  if (!core.length) return null

  const points: KpiMonthlyPoint[] = core.map((row, index) => {
    const previous = core[index - 1]
    return {
      key: `${row.year}-${String(row.monthNumber).padStart(2, "0")}`,
      label: label(row.year, row.monthNumber),
      year: row.year,
      monthNumber: row.monthNumber,
      revenue: n(row.revenue),
      tdv: n(row.tdv),
      deposits: n(row.deposits),
      activeRenters: n(row.activeRenters),
      takeRate: known(row.revenue) && known(row.tdv) ? ratio(row.revenue, row.tdv) : null,
      arpu: known(row.revenue) && known(row.activeRenters) ? ratio(row.revenue, row.activeRenters) : null,
      avgDeposit: known(row.tdv) && known(row.deposits) ? ratio(row.tdv, row.deposits) : null,
      revenueGrowth: previous ? growth(row.revenue, previous.revenue) : null,
      depositGrowth: previous ? growth(row.deposits, previous.deposits) : null,
    }
  })

  const totalRevenue = core.reduce((sum, row) => sum + n(row.revenue), 0)
  const totalTdv = core.reduce((sum, row) => sum + n(row.tdv), 0)
  const totalDeposits = core.reduce((sum, row) => sum + n(row.deposits), 0)
  const matchedArpu = core.filter(row => known(row.revenue) && known(row.activeRenters) && n(row.activeRenters) > 0)
  const renterMonths = matchedArpu.reduce((sum, row) => sum + n(row.activeRenters), 0)
  const arpuRevenue = matchedArpu.reduce((sum, row) => sum + n(row.revenue), 0)

  const firstRevenue = core.find(row => known(row.revenue) && n(row.revenue) > 0)
  const lastRevenue = [...core].reverse().find(row => known(row.revenue) && n(row.revenue) > 0)
  const firstDeposits = core.find(row => known(row.deposits) && n(row.deposits) > 0)
  const lastDeposits = [...core].reverse().find(row => known(row.deposits) && n(row.deposits) > 0)

  const last = core[core.length - 1]
  const previous = core.length > 1 ? core[core.length - 2] : null

  const prospects = valueRows.reduce((sum, row) => sum + n(row.prospectsContacted), 0)
  const meetings = valueRows.reduce((sum, row) => sum + n(row.meetings), 0)
  const rentersActivated = valueRows.reduce((sum, row) => sum + n(row.rentersActivated), 0)
  const firstDepositRenters = valueRows.reduce((sum, row) => sum + n(row.firstDepositRenters), 0)
  const signedRevenue = valueRows.reduce((sum, row) => sum + n(row.signedRevenue), 0)
  const cashCollected = valueRows.reduce((sum, row) => sum + n(row.cashCollected), 0)
  const netMargin = valueRows.reduce((sum, row) => sum + n(row.netMargin), 0)

  const campaignSpend = campaignRows.reduce((sum, row) => sum + n(row.spend), 0)
  const campaignCash = campaignRows.reduce((sum, row) => sum + n(row.cashCollected), 0)

  const first = core[0]
  const spanMonths = Math.max(1, key(last.year, last.monthNumber) - key(first.year, first.monthNumber) + 1)

  return {
    firstLabel: label(first.year, first.monthNumber),
    lastLabel: label(last.year, last.monthNumber),
    spanMonths,
    totalRevenue,
    totalTdv,
    totalDeposits,
    currentMau: known(last.activeRenters) ? last.activeRenters : null,
    weightedTakeRate: ratio(totalRevenue, totalTdv),
    weightedArpu: ratio(arpuRevenue, renterMonths),
    avgDeposit: ratio(totalTdv, totalDeposits),
    revenueGrowth: firstRevenue && lastRevenue ? geometricMonthlyGrowth(firstRevenue.revenue, lastRevenue.revenue, key(lastRevenue.year, lastRevenue.monthNumber) - key(firstRevenue.year, firstRevenue.monthNumber)) : null,
    tdvGrowth: previous ? growth(last.tdv, previous.tdv) : null,
    depositGrowth: firstDeposits && lastDeposits ? geometricMonthlyGrowth(firstDeposits.deposits, lastDeposits.deposits, key(lastDeposits.year, lastDeposits.monthNumber) - key(firstDeposits.year, firstDeposits.monthNumber)) : null,
    mauGrowth: previous ? growth(last.activeRenters, previous.activeRenters) : null,
    prospects,
    meetings,
    rentersActivated,
    firstDepositRenters,
    closingRate: ratio(rentersActivated, meetings),
    signedRevenue,
    cashCollected,
    collectionRate: ratio(cashCollected, signedRevenue),
    netMargin,
    marginRate: ratio(netMargin, totalRevenue),
    campaignSpend,
    campaignCash,
    cashRoas: ratio(campaignCash, campaignSpend),
    coverage: {
      revenue: core.filter(row => known(row.revenue)).length,
      tdv: core.filter(row => known(row.tdv)).length,
      deposits: core.filter(row => known(row.deposits)).length,
      activeRenters: core.filter(row => known(row.activeRenters)).length,
      total: spanMonths,
    },
    points,
  }
}
