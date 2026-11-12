import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const source = stripTypeScriptTypes(readFileSync(new URL("../lib/call-analytics-math.ts", import.meta.url), "utf8"))
  .replace('import type { CallMetric, CallMetrics, CallMetricKey, CallStatsRow } from "@/lib/call-analytics-types";', "");
const { verifiedCallVolume } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("the unique call detail count, not the cached provider summary, is the total", () => {
  const value = verifiedCallVolume({checkedCalls:21,partial:false},{checkedCalls:11,partial:false});
  assert.equal(value.value,21);
  assert.equal(value.previous,11);
  assert.equal(value.available,true);
});
test("unavailable or incomplete Allo history must never look like zero or an exact count", () => {
  assert.equal(verifiedCallVolume(null,null).available,false);
  assert.equal(verifiedCallVolume({checkedCalls:400,partial:true},null).available,false);
  const value = verifiedCallVolume({checkedCalls:12,partial:false},{checkedCalls:400,partial:true});
  assert.equal(value.value,12);
  assert.equal(value.previous,null);
});
