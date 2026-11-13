import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { readGandoKpiSourceRecords, parisMonthKey } from "@/lib/gando-kpi-source";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = Record<string, unknown>;
type Mirror = { source_id: string; payload: Row };
type Deposit = {
  id: string; accountId: string; clientId: string; amountCents: number;
  startAt: number | null; createdAt: number | null; updatedAt: number | null; archived: boolean;
};
type Fee = { id: string; clientId: string; amountCents: number; createdAt: number | null };
type Capture = {
  id: string; accountId: string; depositId: string; amountCents: number;
  status: string; activatedAt: number | null; createdAt: number | null;
};
type Receivable = {
  capture_id: string; account_id: string; amount_due_cents: number;
  amount_paid_cents: number; note: string | null; updated_at: string;
};
type Guarantee = {
  captureId: string; depositId: string; amountCents: number; activatedAt: string | null;
  amountDueCents: number | null; amountPaidCents: number | null;
  remainingDueCents: number | null; note: string | null; updatedAt: string | null;
};
type AccountStats = {
  accountId: string; name: string; companyName: string;
  activatedDeposits: number; depositVolumeCents: number; feesCents: number;
  feesMatchedDeposits: number;
  acceptedGuarantees: number; guaranteeAmountCents: number;
  gapFeesVsGuaranteesCents: number;
  confirmedDueCents: number; confirmedPaidCents: number; confirmedOutstandingCents: number;
  unconfirmedGuarantees: number; guarantees: Guarantee[];
};

const MATCH_WINDOW = 14 * 86400_000;
function str(value: unknown) { return typeof value === "string" ? value.trim() : value == null ? "" : String(value); }
function n(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function timestamp(value: unknown) { const parsed = Date.parse(str(value)); return Number.isFinite(parsed) ? parsed : null; }
function dateIso(value: number | null) { return value === null ? null : new Date(value).toISOString(); }
function activeMonth(value: number | null, month: string) {
  return value !== null && (month === "all" || parisMonthKey(value) === month);
}

function feeMatch(deposits: Deposit[], fees: Fee[]) {
  const byClient = new Map<string, Deposit[]>();
  const matched = new Map<string, Fee>();
  const used = new Set<string>();
  for (const deposit of deposits) {
    if (deposit.archived || deposit.startAt === null || !deposit.clientId) continue;
    const group = byClient.get(deposit.clientId) || [];
    group.push(deposit);
    byClient.set(deposit.clientId, group);
  }
  for (const fee of [...fees].sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0))) {
    if (fee.createdAt === null) continue;
    const closest = (byClient.get(fee.clientId) || [])
      .filter(deposit => !used.has(deposit.id))
      .map(deposit => ({
        deposit,
        diff: Math.min(...[deposit.createdAt, deposit.updatedAt]
          .filter((date): date is number => date !== null)
          .map(date => Math.abs(date - fee.createdAt!))),
      }))
      .filter(candidate => candidate.diff <= MATCH_WINDOW)
      .sort((a,b) => a.diff - b.diff)[0];
    if (!closest) continue;
    used.add(closest.deposit.id);
    matched.set(closest.deposit.id, fee);
  }
  return matched;
}

async function buildReport(month: string) {
  const admin = getSupabaseAdmin();
  const [accountRows, depositRows, operationRows, captureRows, activationRows, receivablesResult, syncResult] =
    await Promise.all([
      readGandoKpiSourceRecords("accounts"),
      readGandoKpiSourceRecords("deposits"),
      readGandoKpiSourceRecords("client_operations"),
      readGandoKpiSourceRecords("captures"),
      readGandoKpiSourceRecords("guarantee_activations"),
      admin.from("kpi_loueur_guarantee_receivables").select("*"),
      admin.from("gando_source_sync_state").select("source_table,last_completed_at,status")
        .in("source_table", ["deposits", "client_operations", "captures", "guarantee_activations"]),
    ]);
  if (receivablesResult.error) throw receivablesResult.error;
  if (syncResult.error) throw syncResult.error;

  const accountById = new Map(accountRows.map(account => [account.source_id, account.payload]));
  const deposits: Deposit[] = depositRows.map(record => ({
    id: record.source_id, accountId: str(record.payload.account_id),
    clientId: str(record.payload.client_id), amountCents: n(record.payload.amount_cents),
    startAt: timestamp(record.payload.start_at), createdAt: timestamp(record.payload.created_at),
    updatedAt: timestamp(record.payload.updated_at),
    archived: record.payload.is_archived === true || record.payload.is_archived === "true",
  }));
  const depositById = new Map(deposits.map(deposit => [deposit.id, deposit]));
  const fees: Fee[] = operationRows.filter(row => str(row.payload.type) === "fee")
    .map(row => ({
      id: row.source_id, clientId: str(row.payload.client_id),
      amountCents: n(row.payload.amount), createdAt: timestamp(row.payload.created_at),
    })).filter(row => row.clientId && row.amountCents > 0 && row.createdAt !== null);
  const feesByDeposit = feeMatch(deposits, fees);
  const captureById = new Map<string, Capture>(captureRows.map(row => [row.source_id, {
    id: row.source_id, accountId: str(row.payload.account_id),
    depositId: str(row.payload.deposit_id), amountCents: n(row.payload.amount_cents),
    status: str(row.payload.status), activatedAt: timestamp(row.payload.guarantee_activated_at),
    createdAt: timestamp(row.payload.created_at),
  }]));
  const receivableByCapture = new Map<string, Receivable>(
    ((receivablesResult.data || []) as Receivable[]).map(row => [row.capture_id, row]),
  );

  const groups = new Map<string, AccountStats>();
  const getGroup = (accountId: string) => {
    if (!groups.has(accountId)) {
      const props = accountById.get(accountId) || {};
      const companyName = str(props.company_name);
      const name = str(props.display_name) || companyName || "Compte " + accountId.slice(-6);
      groups.set(accountId, {
        accountId, name, companyName, activatedDeposits: 0,
        depositVolumeCents: 0, feesCents: 0, feesMatchedDeposits: 0,
        acceptedGuarantees: 0, guaranteeAmountCents: 0, gapFeesVsGuaranteesCents: 0,
        confirmedDueCents: 0, confirmedPaidCents: 0, confirmedOutstandingCents: 0,
        unconfirmedGuarantees: 0, guarantees: [],
      });
    }
    return groups.get(accountId)!;
  };

  for (const deposit of deposits) {
    if (deposit.archived || !deposit.accountId || !activeMonth(deposit.startAt, month)) continue;
    const group = getGroup(deposit.accountId);
    group.activatedDeposits += 1;
    group.depositVolumeCents += deposit.amountCents;
    const fee = feesByDeposit.get(deposit.id);
    if (fee) { group.feesCents += fee.amountCents; group.feesMatchedDeposits += 1; }
  }

  let unmatchedGuarantees = 0;
  const seenCaptures = new Set<string>();
  for (const activation of activationRows) {
    if (str(activation.payload.status) !== "accepted") continue;
    const captureId = str(activation.payload.capture_id);
    if (!captureId || seenCaptures.has(captureId)) continue;
    seenCaptures.add(captureId);
    const capture = captureById.get(captureId);
    if (!capture) { unmatchedGuarantees += 1; continue; }
    const accountId = capture.accountId || depositById.get(capture.depositId)?.accountId || "";
    const at = capture.activatedAt || timestamp(activation.payload.reviewed_at) ||
      timestamp(activation.payload.created_at) || capture.createdAt;
    if (!accountId) { unmatchedGuarantees += 1; continue; }
    if (!activeMonth(at, month)) continue;
    const group = getGroup(accountId);
    group.acceptedGuarantees += 1;
    group.guaranteeAmountCents += Math.max(0, capture.amountCents);
    const matchingDebt = receivableByCapture.get(captureId);
    const debt = matchingDebt?.account_id === accountId ? matchingDebt : null;
    if (debt) {
      group.confirmedDueCents += n(debt.amount_due_cents);
      group.confirmedPaidCents += n(debt.amount_paid_cents);
      group.confirmedOutstandingCents += n(debt.amount_due_cents) - n(debt.amount_paid_cents);
    } else {
      group.unconfirmedGuarantees += 1;
    }
    group.guarantees.push({
      captureId, depositId: capture.depositId, amountCents: capture.amountCents,
      activatedAt: dateIso(at),
      amountDueCents: debt ? n(debt.amount_due_cents) : null,
      amountPaidCents: debt ? n(debt.amount_paid_cents) : null,
      remainingDueCents: debt ? n(debt.amount_due_cents) - n(debt.amount_paid_cents) : null,
      note: debt?.note || null, updatedAt: debt?.updated_at || null,
    });
  }

  const rows = [...groups.values()].map(group => ({
    ...group,
    gapFeesVsGuaranteesCents: group.feesCents - group.guaranteeAmountCents,
    guarantees: group.guarantees.sort((a,b) => String(b.activatedAt).localeCompare(String(a.activatedAt))),
  })).sort((a,b) =>
    b.guaranteeAmountCents - a.guaranteeAmountCents ||
    b.confirmedOutstandingCents - a.confirmedOutstandingCents ||
    b.feesCents - a.feesCents
  );
  const sum = (key: keyof AccountStats) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  const dates = (syncResult.data || []).filter(row => row.status === "success")
    .map(row => row.last_completed_at).filter((value): value is string => Boolean(value)).sort();
  return {
    period: month,
    source: { lastSyncedAt: dates.at(-1) || null },
    summary: {
      renters: rows.length,
      activatedDeposits: sum("activatedDeposits"),
      feesCents: sum("feesCents"),
      acceptedGuarantees: sum("acceptedGuarantees"),
      guaranteeAmountCents: sum("guaranteeAmountCents"),
      gapFeesVsGuaranteesCents: sum("feesCents") - sum("guaranteeAmountCents"),
      confirmedDueCents: sum("confirmedDueCents"),
      confirmedPaidCents: sum("confirmedPaidCents"),
      confirmedOutstandingCents: sum("confirmedOutstandingCents"),
      unconfirmedGuarantees: sum("unconfirmedGuarantees"),
    },
    quality: {
      matchedFees: rows.reduce((n, row) => n + row.feesMatchedDeposits, 0),
      unmatchedAcceptedGuarantees: unmatchedGuarantees,
      feeMatchApproximate: true,
    },
    rows,
  };
}
function fail(error: unknown) {
  const status = Number((error as { status?: number })?.status || 500);
  return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur KPI loueurs." },
    { status: [400,401,403,404,409,429,503].includes(status) ? status : 500,
      headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    if (!access.canAccessKpi) return NextResponse.json({ error: "Accès KPI non autorisé." }, { status: 403 });
    const requested = request.nextUrl.searchParams.get("month") || "all";
    if (requested !== "all" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requested)) {
      return NextResponse.json({ error: "Période invalide." }, { status: 400 });
    }
    return NextResponse.json({ ...await buildReport(requested), canEdit: access.role === "admin" },
      { headers: { "cache-control": "private, no-store" } });
  } catch (error) { console.error("KPI loueurs et garanties", error); return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    if (access.role !== "admin") return NextResponse.json({ error: "Validation réservée aux administrateurs." }, { status: 403 });
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin)
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const captureId = str(body.captureId);
    const accountId = str(body.accountId);
    const due = Number(body.amountDueCents);
    const paid = Number(body.amountPaidCents);
    const note = str(body.note).slice(0, 1500);
    if (!/^[a-zA-Z0-9_-]{8,90}$/.test(captureId) || !/^[a-zA-Z0-9_-]{8,90}$/.test(accountId))
      return NextResponse.json({ error: "Identifiant garantie ou loueur invalide." }, { status: 400 });
    if (![due,paid].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000) || paid > due)
      return NextResponse.json({ error: "Montants invalides : le paiement ne peut dépasser le montant dû." }, { status: 400 });

    const [captures, activations] = await Promise.all([
      readGandoKpiSourceRecords("captures"),
      readGandoKpiSourceRecords("guarantee_activations"),
    ]);
    const capture = captures.find(item => item.source_id === captureId);
    if (!capture || str(capture.payload.account_id) !== accountId ||
      !activations.some(item => str(item.payload.capture_id) === captureId && str(item.payload.status) === "accepted")) {
      return NextResponse.json({ error: "Aucune garantie acceptée ne correspond à ce loueur." }, { status: 409 });
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("kpi_loueur_guarantee_receivables").upsert({
      capture_id: captureId, account_id: accountId,
      amount_due_cents: due, amount_paid_cents: paid, note: note || null,
      updated_at: new Date().toISOString(), updated_by: access.email || null,
    }, { onConflict: "capture_id" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ saved: true, item: data },
      { headers: { "cache-control": "private, no-store" } });
  } catch (error) { console.error("KPI loueur debt update", error); return fail(error); }
}
