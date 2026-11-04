import "server-only";

export type AlloTranscriptLine = { speaker: string; text: string; at: string | null };
export type AlloAction = { text: string; assignedTo: string | null; dueAt: string | null };
export type AlloAgent = { name: string; role: string | null; email: string | null };

export type AlloCallDetailView = {
  id: string;
  title: string;
  contactName: string | null;
  contactNumber: string | null;
  memberName: string | null;
  memberEmail: string | null;
  startedAt: string | null;
  direction: string | null;
  status: string | null;
  durationSeconds: number | null;
  tags: string[];
  summary: string | null;
  transcript: AlloTranscriptLine[];
  transcriptText: string | null;
  actions: AlloAction[];
  agents: AlloAgent[];
  recordingAvailable: boolean;
};

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => x && typeof x === "object" && !Array.isArray(x) ? x as Obj : {};
const str = (x: unknown): string | null => typeof x === "string" ? x.trim() || null : typeof x === "number" && Number.isFinite(x) ? String(x) : null;
const first = (o: Obj, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return null;
};
const capped = (x: unknown, cap = 70000) => (str(x) || "").slice(0, cap) || null;
const vals = (x: unknown) => Array.isArray(x) ? x : [];
const time = (x: unknown): string | null => {
  if (x === null || x === undefined) return null;
  if (typeof x === "number" && Number.isFinite(x)) {
    const d = new Date(x < 1e11 ? x * 1000 : x);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof x === "string" && !Number.isNaN(Date.parse(x))) return new Date(x).toISOString();
  return null;
};
function summaryValue(value: unknown): string | null {
  const plain = capped(value);
  if (plain) return plain;
  const o = obj(value);
  const body = capped(first(o, ["markdown", "content", "text", "summary", "body"]));
  if (body) return body;
  const sections = vals(first(o, ["sections", "items"]));
  const parts = sections.map(s => {
    const entry = obj(s);
    const title = str(first(entry, ["name", "title", "label", "heading"]));
    const content = str(first(entry, ["content", "value", "text", "body"]));
    return [title ? "### " + title : null, content].filter(Boolean).join("\n");
  }).filter(Boolean);
  return parts.join("\n\n").slice(0, 70000) || null;
}
function transcriptValue(value: unknown) {
  const o = obj(value);
  const collection = vals(value).length ? vals(value) : vals(first(o, ["segments", "turns", "utterances", "lines", "items"]));
  const lines: AlloTranscriptLine[] = collection.flatMap(entry => {
    if (typeof entry === "string") return [{ speaker: "", text: entry.slice(0, 6000), at: null }];
    const item = obj(entry);
    const text = capped(first(item, ["text", "content", "transcript", "utterance"]), 6000);
    if (!text) return [];
    const rawAt = first(item, ["start_time", "startTime", "timestamp", "time", "start", "offset"]);
    let at: string | null = null;
    if (typeof rawAt === "number" && Number.isFinite(rawAt) && rawAt >= 0) {
      const seconds = rawAt > 10000 ? rawAt / 1000 : rawAt;
      at = Math.floor(seconds / 60).toString().padStart(2,"0")+":"+Math.floor(seconds % 60).toString().padStart(2,"0");
    } else if (typeof rawAt === "string") at = rawAt.slice(0, 16);
    const speakerData = first(item, ["speaker", "speaker_name", "speakerName", "role", "agent"]);
    const speaker = typeof speakerData === "object" ? str(first(obj(speakerData), ["name", "label", "role"])) || "" : str(speakerData) || "";
    return [{ speaker, text, at }];
  }).slice(0, 500);
  const rawText = capped(typeof value === "string" ? value : first(o, ["full_text", "text", "content", "transcript"]), 90000);
  return { lines, text: rawText || (lines.length ? lines.map(line => (line.speaker ? line.speaker + " : " : "") + line.text).join("\n").slice(0, 90000) : null) };
}
function actionValues(source: unknown): AlloAction[] {
  const array = vals(source).length ? vals(source) : vals(first(obj(source), ["items", "actions", "tasks"]));
  if (array.length) return array.flatMap(value => {
    if (typeof value === "string") return value.trim() ? [{ text: value.trim().slice(0, 1000), assignedTo: null, dueAt: null }] : [];
    const item = obj(value);
    const body = str(first(item, ["text", "title", "description", "task", "content", "action"]));
    if (!body) return [];
    return [{ text: body.slice(0, 1000), assignedTo: str(first(item, ["assignee", "owner", "assigned_to", "assignedTo"])), dueAt: time(first(item, ["due_at", "dueAt", "deadline"])) }];
  }).slice(0, 40);
  if (typeof source === "string") return source.split(/\n+/).map(s => s.replace(/^\s*[-*•\d.)]+\s*/, "").trim()).filter(Boolean).slice(0, 40).map(text => ({ text: text.slice(0, 1000), assignedTo: null, dueAt: null }));
  return [];
}
function actionsFromSummary(markdown: string | null): AlloAction[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  let active = false;
  const items: string[] = [];
  for (const line of lines) {
    const stripped = line.trim().replace(/^#{1,6}\s*/, "").replace(/\*\*/g,"").replace(/:$/, "");
    if (/^(actions?(?:\s+items?)?|prochaines?\s+étapes?|à\s+faire|next\s+steps?|tâches?\s+à\s+(?:effectuer|réaliser))$/i.test(stripped)) { active = true; continue; }
    if (active && /^#{1,6}\s/.test(line)) break;
    if (active) {
      const match = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
      if (match && match[1].trim()) items.push(match[1].trim());
    }
    if (items.length >= 40) break;
  }
  return items.map(text => ({ text: text.slice(0, 1000), assignedTo: null, dueAt: null }));
}
function agentValues(call: Obj): AlloAgent[] {
  const raw = vals(first(call, ["agents", "participants", "ai_agents", "team_members"]));
  const agents = raw.flatMap(value => {
    const agent = obj(value);
    const name = str(first(agent, ["name", "full_name", "display_name", "label"]));
    const email = str(first(agent, ["email", "user_email"]));
    if (!name && !email) return [];
    return [{ name: name || email!, role: str(first(agent, ["role", "type", "title"])), email }];
  });
  const user = obj(first(call, ["user", "owner", "agent", "team_member"]));
  const userEmail = str(first(call, ["user_email", "agent_email"])) || str(first(user, ["email"]));
  const userName = str(first(user, ["name", "full_name", "display_name"])) || str(first(call, ["user_name", "agent_name"]));
  if (userName || userEmail) agents.unshift({ name: userName || userEmail!, role: "Commercial", email: userEmail });
  return [...new Map(agents.map(a => [(a.email || a.name).toLowerCase(), a])).values()].slice(0, 15);
}
function tagValues(call: Obj): string[] {
  const values = vals(first(call, ["tags", "call_tags", "labels"]));
  return [...new Set(values.map(value => typeof value === "string" ? value : str(first(obj(value), ["name", "label", "title", "key"])) || "").filter(Boolean))].slice(0, 30);
}
export function shapeWithAlloCallDetail(value: unknown): AlloCallDetailView {
  const call = obj(value);
  const contact = obj(first(call, ["person", "contact", "crm_person", "customer"]));
  const user = obj(first(call, ["user", "owner", "agent", "team_member"]));
  const summary = summaryValue(first(call, ["summary", "ai_summary", "aiSummary", "call_summary", "callSummary", "summary_markdown"]));
  const transcript = transcriptValue(first(call, ["transcriptions", "transcript", "concatenated_transcript", "transcription", "transcript_text", "transcriptText", "transcript_segments"]));
  const memberEmail = str(first(call, ["user_email", "agent_email", "owner_email"])) || str(first(user, ["email"]));
  const memberName = str(first(user, ["name", "full_name", "display_name"])) || str(first(call, ["user_name", "agent_name"])) || memberEmail;
  const phone = str(first(call, ["contact_number", "external_number", "to", "to_number", "from_number"])) || str(first(contact, ["phone", "phone_number", "number"]));
  const contactName = str(first(contact, ["name", "full_name", "display_name"])) || str(first(call, ["contact_name", "person_name", "customer_name"]));
  const explicitActions = actionValues(first(call, ["action_items", "actions", "ai_actions", "next_steps", "follow_ups"]) ?? first(obj(call.summary), ["action_items", "actions"]));
  const durationRaw = first(call, ["duration_seconds", "durationSeconds", "duration", "call_duration", "recording_duration"]);
  const duration = Number(durationRaw);
  const title = str(first(call, ["title", "subject", "call_title", "ai_title", "topic"])) || "Appel avec " + (contactName || phone || "un contact");
  return {
    id: str(first(call, ["id"])) || "",
    title: title.slice(0, 200),
    contactName, contactNumber: phone,
    memberName, memberEmail,
    startedAt: time(first(call, ["date", "start_date", "started_at", "startedAt", "created_at", "timestamp"])),
    direction: str(first(call, ["direction", "call_direction"])),
    status: str(first(call, ["result", "status", "outcome"])),
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
    tags: tagValues(call), summary, transcript: transcript.lines, transcriptText: transcript.text,
    actions: explicitActions.length ? explicitActions : actionsFromSummary(summary),
    agents: agentValues(call),
    recordingAvailable: Boolean(first(call, ["recording_url", "recording_download_url", "audio_url"])) || Number(call.recording_duration || 0) > 0 || call.recording === true,
  };
}
