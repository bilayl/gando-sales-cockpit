import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(new URL("../lib/call-timing.ts", import.meta.url), "utf8");
const { isWithinFrenchCallWindow, getBestCallTimeForProperties } =
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
  assert.equal(getBestCallTimeForProperties({ timezone: "America/Guadeloupe" }, new Date("2026-11-09T13:59:00Z")).callNow, false); // 08:59 local
  assert.equal(getBestCallTimeForProperties({ timezone: "America/Guadeloupe" }, new Date("2026-11-09T14:00:00Z")).callNow, true); // 09:00 local
  assert.equal(getBestCallTimeForProperties({ timezone: "Asia/Dubai" }, new Date("2026-11-09T15:00:00Z")).callNow, false); // 19:00 local
});
