import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(new URL("../lib/call-timing.ts", import.meta.url), "utf8");
const { isWithinFrenchCallWindow, getBestCallTimeForProperties, getSessionCallTimeForProperties } =
  await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64"));

const on = (time) => isWithinFrenchCallWindow(new Date(time));

test("Paris winter business hours: morning, lunch break and afternoon boundaries", () => {
  assert.equal(on("2026-11-09T07:59:00Z"), false); // 08:59 Paris
  assert.equal(on("2026-11-09T08:00:00Z"), true);  // 09:00 Paris
  assert.equal(on("2026-11-09T10:59:00Z"), true);  // 11:59 Paris
  assert.equal(on("2026-11-09T11:00:00Z"), false); // 12:00 Paris
  assert.equal(on("2026-11-09T12:59:00Z"), false); // 13:59 Paris
  assert.equal(on("2026-11-09T13:00:00Z"), true);  // 14:00 Paris
  assert.equal(on("2026-11-09T16:59:00Z"), true);  // 17:59 Paris
  assert.equal(on("2026-11-09T17:00:00Z"), false); // 18:00 Paris
});
test("Paris summer time is handled automatically", () => {
  assert.equal(on("2026-07-01T06:59:00Z"), false); // 08:59 CEST
  assert.equal(on("2026-07-01T07:00:00Z"), true);  // 09:00 CEST
  assert.equal(on("2026-07-01T16:00:00Z"), false); // 18:00 CEST
});
test("Calling hours apply to France on weekdays only", () => {
  assert.equal(on("2026-11-08T09:00:00Z"), false); // Sunday
  assert.equal(on("2026-11-07T13:00:00Z"), false); // Saturday
});
test("prospect in Guadeloupe can be prepared from 9h Paris but not called at 4h locally", () => {
  const morning = new Date("2026-11-09T08:30:00Z"); // 09:30 Paris, 04:30 Guadeloupe
  const paris = getBestCallTimeForProperties({ timezone: "Europe/Paris" }, morning);
  const guadeloupe = getBestCallTimeForProperties({ timezone: "America/Guadeloupe" }, morning);
  const unknown = getBestCallTimeForProperties({}, morning);
  assert.equal(paris.callNow, true);
  assert.equal(guadeloupe.callNow, false);
  assert.match(guadeloupe.reason, /Trop tôt|trop tard/);
  assert.equal(unknown.callNow, true);
  assert.equal(unknown.localTime, null);
});

test("afternoon France calls work for the Antilles after local 9h, but not in East Asia at night", () => {
  const afternoon = new Date("2026-11-09T14:00:00Z"); // 15:00 Paris, 10:00 Guadeloupe
  assert.equal(getBestCallTimeForProperties({ phone: "+590690000000" }, afternoon).callNow, true);
  assert.equal(getBestCallTimeForProperties({ timezone: "Asia/Tokyo" }, afternoon).callNow, false);
});

test("prospect local daytime has an exact 9:00 and 19:00 boundary", () => {
  const beforeGuadeloupe = getBestCallTimeForProperties({ timezone: "America/Guadeloupe" }, new Date("2026-11-09T12:59:00Z"));
  const openingGuadeloupe = getBestCallTimeForProperties({ timezone: "America/Guadeloupe" }, new Date("2026-11-09T13:00:00Z"));
  assert.equal(beforeGuadeloupe.localTime, "08:59");
  assert.equal(beforeGuadeloupe.callNow, false);
  assert.equal(openingGuadeloupe.localTime, "09:00");
  assert.equal(openingGuadeloupe.callNow, true);
  assert.equal(getBestCallTimeForProperties({ timezone: "Asia/Dubai" }, new Date("2026-11-09T15:00:00Z")).callNow, false); // 19:00 local
});

test("session: Paris at 22h is not callable, but the prospect remains in the session", () => {
  const blocked = getSessionCallTimeForProperties({ country: "France", city: "Paris", phone: "+33612345678" }, new Date("2026-11-09T21:00:00Z"));
  assert.equal(blocked.localTime, "22:00");
  assert.equal(blocked.timezone, "Europe/Paris");
  assert.equal(blocked.callNow, false);
  assert.match(blocked.reason, /À appeler plus tard/);
});

test("session: Guadeloupe at 5h cannot be called, including locally formatted 0690 numbers", () => {
  const early = getSessionCallTimeForProperties({ country: "France", phone: "0690 12 34 56" }, new Date("2026-11-09T09:00:00Z"));
  assert.equal(early.timezone, "America/Guadeloupe");
  assert.equal(early.localTime, "05:00");
  assert.equal(early.callNow, false);
});

test("session: eligible prospect can be called at 10h in Guadeloupe, even though other SDRs may be working the same account", () => {
  const good = getSessionCallTimeForProperties({ phone: "+590690000000" }, new Date("2026-11-09T14:00:00Z"));
  assert.equal(good.localTime, "10:00");
  assert.equal(good.callNow, true);
});

test("session: local 9h–19h boundaries and weekend exclusion work independently of France calling slots", () => {
  const paris = { timezone: "Europe/Paris" };
  assert.equal(getSessionCallTimeForProperties(paris, new Date("2026-11-09T07:59:00Z")).callNow, false); // 08:59
  assert.equal(getSessionCallTimeForProperties(paris, new Date("2026-11-09T08:00:00Z")).callNow, true); // 09:00
  assert.equal(getSessionCallTimeForProperties(paris, new Date("2026-11-09T11:30:00Z")).callNow, true); // 12:30 lunch time; session is not globally gated
  assert.equal(getSessionCallTimeForProperties(paris, new Date("2026-11-09T17:59:00Z")).callNow, true); // 18:59
  assert.equal(getSessionCallTimeForProperties(paris, new Date("2026-11-09T18:00:00Z")).callNow, false); // 19:00
  assert.equal(getSessionCallTimeForProperties(paris, new Date("2026-11-08T11:00:00Z")).callNow, false); // Sunday
});

test("session: missing prospect timezone is labeled as a cautious Paris fallback", () => {
  const unknown = getSessionCallTimeForProperties({}, new Date("2026-11-09T21:00:00Z"));
  assert.equal(unknown.timezone, "Europe/Paris");
  assert.equal(unknown.confidence, "low");
  assert.equal(unknown.callNow, false);
  assert.match(unknown.reason, /Fuseau non renseigné/);
});
