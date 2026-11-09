import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Load the real production classifier, without adding an external test runner
// to Next.js. Node 22+ strips the TypeScript annotations before import.
const source = readFileSync(new URL("../lib/call-outcome.ts", import.meta.url), "utf8");
const esm = stripTypeScriptTypes(source);
const { classifyAlloAnswer, classifyHubSpotAnswer, isNrP } =
  await import("data:text/javascript;base64," + Buffer.from(esm).toString("base64"));

test("technical ANSWERED with NRP tag is NOT answered", () => {
  assert.equal(classifyAlloAnswer({result:"ANSWERED",tags:["NRP"]}),"unanswered");
  assert.equal(classifyAlloAnswer({result:"ANSWERED",tags:[{name:"Ne répond pas"}]}),"unanswered");
  assert.equal(classifyAlloAnswer({result:"TRANSFERRED",disposition:"no_answer"}),"unanswered");
});
test("voicemail, no answer and busy are not answered even when line connects", () => {
  for (const tag of ["Messagerie","Répondeur","VOICEMAIL","pas de réponse","Busy"]) {
    assert.equal(classifyAlloAnswer({result:"ANSWERED",tags:[tag]}),"unanswered",tag);
  }
});
test("positive or unknown Allo outcomes are distinguished", () => {
  assert.equal(classifyAlloAnswer({result:"ANSWERED",tags:[]}),"answered");
  assert.equal(classifyAlloAnswer({result:"NO_ANSWER"}),"unanswered");
  assert.equal(classifyAlloAnswer({result:"RINGING"}),"unknown");
  assert.equal(isNrP([{name:"NRP"}]),true);
});
test("HubSpot status COMPLETED + No answer disposition is NOT answered", () => {
  assert.equal(classifyHubSpotAnswer({
    hs_call_status:"COMPLETED",
    hs_call_disposition:"73a0d17f-1163-4015-bdd5-ec830791da20",
  }),"unanswered");
});
test("HubSpot status QUEUED + Connected is not yet an answered call", () => {
  assert.equal(classifyHubSpotAnswer({
    hs_call_status:"QUEUED",
    hs_call_disposition:"f240bbac-87c9-4f6e-bf70-924b57d47db7",
  }),"unknown");
});
test("HubSpot status COMPLETED + Connected is answered unless explicitly NRP", () => {
  const disposition="f240bbac-87c9-4f6e-bf70-924b57d47db7";
  assert.equal(classifyHubSpotAnswer({hs_call_status:"COMPLETED",hs_call_disposition:disposition}),"answered");
  assert.equal(classifyHubSpotAnswer({hs_call_status:"COMPLETED",hs_call_disposition:disposition,hs_call_title:"NRP"}),"unanswered");
});
test("HubSpot recorded voicemail is not a human answer", () => {
  assert.equal(classifyHubSpotAnswer({
    hs_call_status:"COMPLETED",
    hs_call_disposition:"b2cf5968-551e-4856-9783-52b3da59a7d0",
  }),"unanswered");
});
