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
test("SDR/prospect timezone and missing prospect timezone do not disable button", () => {
  const date = new Date("2026-11-09T08:30:00Z");
  const paris = getBestCallTimeForProperties({ timezone: "Europe/Paris" }, date);
  const tokyo = getBestCallTimeForProperties({ timezone: "Asia/Tokyo" }, date);
  const guadeloupe = getBestCallTimeForProperties({ timezone: "America/Guadeloupe" }, date);
  const unknown = getBestCallTimeForProperties({}, date);
  assert.deepEqual([paris.callNow,tokyo.callNow,guadeloupe.callNow,unknown.callNow],[true,true,true,true]);
  assert.notEqual(paris.localTime,guadeloupe.localTime);
  assert.equal(unknown.localTime,null);
});
