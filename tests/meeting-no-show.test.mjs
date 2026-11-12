import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(new URL("../lib/company-prospection-priority.ts", import.meta.url), "utf8");
const { getCompanyProspectionDecision } = await import(
  "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64")
);

const lead = {
  id: "company-1",
  properties: {
    qualification_status: "À relancer",
    prospecting_status: "À relancer",
    statut_prospection: "À relancer",
    qualification_source: "meeting_no_show",
    qualification_reason: "Prospect absent au rendez-vous — SDR : rappeler",
    qualification_next_action_at: "2030-06-01T09:00:00Z",
    statut_de_lappel: "pas_interesse",
    qualification_last_call_status: "pas_interesse",
  },
};

test("no-show reappears immediately as priority SDR action despite stale call status", () => {
  const decision = getCompanyProspectionDecision(lead, "FOLLOW_UP", Date.parse("2026-11-12T10:00:00Z"));
  assert.equal(decision.bucket, "ACTIONABLE");
  assert.equal(decision.priority, 1);
  assert.equal(decision.priorityLabel, "P1 · RDV manqué");
  assert.match(decision.reason, /Prospect absent/);
});

test("scheduled meeting is excluded from active calling until the appointment", () => {
  const decision = getCompanyProspectionDecision(lead, "DEMO_SCHEDULED");
  assert.equal(decision.bucket, "OPPORTUNITY");
});

test("a won client is never reopened as a prospect by a no-show flag", () => {
  const decision = getCompanyProspectionDecision(
    { ...lead, properties: { ...lead.properties, lifecyclestage: "customer" } },
    "WON",
  );
  assert.equal(decision.bucket, "EXCLUDED");
});
