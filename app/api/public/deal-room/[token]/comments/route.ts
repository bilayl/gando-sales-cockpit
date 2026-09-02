import { NextRequest } from "next/server";
import { addPublicSDRoomCommentWithIdentity, getPublicSDRoomWithIdentity } from "@/lib/sd-room-public-identity";
import { SD_CODES, type SDCode } from "@/lib/sd-room-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email") || "";
    const firstName = url.searchParams.get("firstName") || "";
    const lastName = url.searchParams.get("lastName") || "";
    const requestedCode = url.searchParams.get("documentCode");
    const documentCode: SDCode | null = requestedCode && SD_CODES.includes(requestedCode as SDCode) ? requestedCode as SDCode : null;

    const roomData = await getPublicSDRoomWithIdentity({ token, email, firstName, lastName });
    let query = getSupabaseAdmin()
      .from("deal_room_comments")
      .select("id,room_id,document_code,section_key,author_email,author_first_name,author_last_name,body,status,created_at,resolved_at")
      .eq("room_id", roomData.room.id)
      .order("created_at", { ascending: true })
      .limit(100);
    if (documentCode) query = query.eq("document_code", documentCode);
    const { data, error } = await query;
    if (error) throw error;

    return Response.json({
      comments: (data || []).map(comment => ({
        id: comment.id,
        documentCode: comment.document_code,
        sectionKey: comment.section_key,
        authorEmail: comment.author_email,
        authorFirstName: comment.author_first_name,
        authorLastName: comment.author_last_name,
        body: comment.body,
        status: comment.status,
        createdAt: comment.created_at,
        resolvedAt: comment.resolved_at,
      })),
    });
  } catch (error) {
    const value = error as Error & { status?: number };
    return Response.json({ error: value.message || "Remarques indisponibles." }, { status: value.status || 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const documentCode: SDCode = SD_CODES.includes(body?.documentCode) ? body.documentCode : "SD01";
    const comment = await addPublicSDRoomCommentWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
      documentCode,
      sectionKey: body?.sectionKey,
      body: body?.body,
    });
    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    const value = error as Error & { status?: number };
    return Response.json({ error: value.message || "Remarque non enregistrée." }, { status: value.status || 500 });
  }
}
