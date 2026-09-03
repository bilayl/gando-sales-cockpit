import "server-only";

import {
  addPublicSDRoomComment,
  getPublicSDRoom,
  recordSDRoomEvent,
} from "@/lib/sd-room";
import type { SD01Content, SDCode } from "@/lib/sd-room-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function cleanName(value: unknown, label: string) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (name.length < 2) {
    throw Object.assign(new Error(`${label} obligatoire.`), { status: 400 });
  }
  return name;
}

function normalizeLegacyPublicSD01<T extends Awaited<ReturnType<typeof getPublicSDRoom>>>(data: T): T {
  return {
    ...data,
    documents: data.documents.map(document => {
      if (document.code !== "SD01") return document;
      const content = document.content as SD01Content;
      if (!content?.roi || Array.isArray(content.roi.estimates)) return document;
      return {
        ...document,
        content: {
          ...content,
          roi: {
            ...content.roi,
            valueLevers: [],
            estimates: Array.isArray(content.roi.valueLevers) ? content.roi.valueLevers : [],
          },
        },
      };
    }),
  } as T;
}

export function normalizePublicVisitorIdentity(firstName: unknown, lastName: unknown) {
  return {
    firstName: cleanName(firstName, "Prénom"),
    lastName: cleanName(lastName, "Nom"),
  };
}

export async function getPublicSDRoomWithIdentity(input: {
  token: string;
  email: unknown;
  firstName: unknown;
  lastName: unknown;
}) {
  const identity = normalizePublicVisitorIdentity(input.firstName, input.lastName);
  const rawData = await getPublicSDRoom(input.token, String(input.email || ""));
  const data = normalizeLegacyPublicSD01(rawData);
  return {
    ...data,
    visitorFirstName: identity.firstName,
    visitorLastName: identity.lastName,
  };
}

export async function recordSDRoomEventWithIdentity(input: {
  token: string;
  email: string;
  firstName: unknown;
  lastName: unknown;
  sessionId: string;
  eventType: "room_opened" | "stage_viewed" | "section_viewed" | "heartbeat";
  documentCode?: SDCode | null;
  activeSeconds?: number;
  metadata?: Record<string, unknown>;
}) {
  const identity = normalizePublicVisitorIdentity(input.firstName, input.lastName);
  const data = await getPublicSDRoom(input.token, input.email);

  await recordSDRoomEvent({
    token: input.token,
    email: input.email,
    sessionId: input.sessionId,
    eventType: input.eventType,
    documentCode: input.documentCode,
    activeSeconds: input.activeSeconds,
    metadata: {
      ...(input.metadata || {}),
      visitorFirstName: identity.firstName,
      visitorLastName: identity.lastName,
    },
  });

  const { error } = await getSupabaseAdmin()
    .from("deal_room_events")
    .update({
      visitor_first_name: identity.firstName,
      visitor_last_name: identity.lastName,
    })
    .eq("room_id", data.room.id)
    .eq("visitor_email", data.visitorEmail)
    .eq("session_id", String(input.sessionId || "").slice(0, 120));
  if (error) throw error;
}

export async function addPublicSDRoomCommentWithIdentity(input: {
  token: string;
  email: string;
  firstName: unknown;
  lastName: unknown;
  documentCode: SDCode;
  sectionKey?: string | null;
  body: string;
}) {
  const identity = normalizePublicVisitorIdentity(input.firstName, input.lastName);
  const comment = await addPublicSDRoomComment({
    token: input.token,
    email: input.email,
    documentCode: input.documentCode,
    sectionKey: input.sectionKey,
    body: input.body,
  });

  const { error } = await getSupabaseAdmin()
    .from("deal_room_comments")
    .update({
      author_first_name: identity.firstName,
      author_last_name: identity.lastName,
    })
    .eq("id", comment.id);
  if (error) throw error;

  return {
    ...comment,
    authorFirstName: identity.firstName,
    authorLastName: identity.lastName,
  };
}
