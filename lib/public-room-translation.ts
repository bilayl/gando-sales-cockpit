import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const MAX_BATCH_CHARS = 10500;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Entry = { id: string; text: string; path: Array<string | number> };

async function getServerSecret(name: string) {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("get_server_secret", { p_name: name });
    if (error) return "";
    return typeof data === "string" ? data.trim() : "";
  } catch {
    return "";
  }
}

async function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || await getServerSecret("openrouter_api_key");
}

function shouldTranslate(value: string) {
  const text = value.trim();
  if (!text || text.length < 2) return false;
  if (/^https?:\/\//i.test(text) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return false;
  if (/^[A-Fa-f0-9]{32,}$/.test(text) || /^SD0[1-5]$/i.test(text)) return false;
  if (/^(draft|review|published|validated|pending|sent|viewed|signed|expired|revoked|failed|done|in_progress|not_started)$/i.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text)) return false;
  return /[A-Za-zÀ-ÿ]/.test(text);
}

function collect(value: JsonValue, path: Array<string | number> = [], out: Entry[] = []) {
  if (typeof value === "string") {
    if (shouldTranslate(value)) out.push({ id: `s${out.length}`, text: value, path });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, [...path, index], out));
    return out;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collect(item, [...path, key], out));
  }
  return out;
}

function setAtPath(root: JsonValue, path: Array<string | number>, next: string) {
  let current = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i += 1) current = current[path[i]] as Record<string | number, unknown>;
  current[path[path.length - 1]] = next;
}

function chunkEntries(entries: Entry[]) {
  const chunks: Entry[][] = [];
  let current: Entry[] = [];
  let size = 0;
  for (const entry of entries) {
    if (entry.text.length > MAX_BATCH_CHARS) {
      if (current.length) { chunks.push(current); current = []; size = 0; }
      const parts = entry.text.match(/[\s\S]{1,9000}(?=\n\n|\n|$)/g) || [entry.text];
      parts.forEach((part, index) => chunks.push([{ ...entry, id: `${entry.id}__${index}`, text: part }]));
      continue;
    }
    if (current.length && size + entry.text.length > MAX_BATCH_CHARS) { chunks.push(current); current = []; size = 0; }
    current.push(entry);
    size += entry.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function translateBatch(token: string, entries: Entry[]) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://room.gando.pro",
      "X-Title": "Gando Deal Room Translation",
    },
    body: JSON.stringify({
      model: process.env.PUBLIC_ROOM_TRANSLATION_MODEL?.trim() || DEFAULT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Translate French business and legal text into clear professional English. Return ONLY valid JSON in the exact shape {\"items\":[{\"id\":\"...\",\"text\":\"...\"}]}. Preserve every id. Never translate or alter URLs, email addresses, IDs, dates, amounts, percentages, product names, Gando, company names, status codes, Markdown heading prefixes (##, ###, ####), pipe-table separators, numbering or legal references. Preserve line breaks and table structure. Do not summarize or add information.",
        },
        { role: "user", content: JSON.stringify({ items: entries.map(item => ({ id: item.id, text: item.text })) }) },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(35000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
  const text = parsed.choices?.[0]?.message?.content || "";
  const json = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as { items?: Array<{ id: string; text: string }> };
  return new Map((json.items || []).map(item => [item.id, item.text]));
}

export async function translatePublicDocumentContent<T>(content: T): Promise<T> {
  const token = await getOpenRouterApiKey();
  if (!token) throw new Error("Traduction anglaise indisponible : OpenRouter n’est pas configuré.");
  const clone = JSON.parse(JSON.stringify(content)) as JsonValue;
  const entries = collect(clone);
  if (!entries.length) return clone as T;

  const longParts = new Map<string, Array<{ index: number; text: string }>>();
  for (const chunk of chunkEntries(entries)) {
    const translated = await translateBatch(token, chunk);
    for (const entry of chunk) {
      const match = entry.id.match(/^(s\d+)__(\d+)$/);
      if (match) {
        const list = longParts.get(match[1]) || [];
        list.push({ index: Number(match[2]), text: translated.get(entry.id) || entry.text });
        longParts.set(match[1], list);
      } else {
        const next = translated.get(entry.id);
        if (next) setAtPath(clone, entry.path, next);
      }
    }
  }
  for (const [baseId, parts] of longParts) {
    const original = entries.find(entry => entry.id === baseId);
    if (original) setAtPath(clone, original.path, parts.sort((a, b) => a.index - b.index).map(part => part.text).join(""));
  }
  return clone as T;
}
