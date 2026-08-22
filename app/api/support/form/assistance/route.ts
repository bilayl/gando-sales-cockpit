import { NextRequest } from "next/server";
import { handlePublicSupportForm, publicSupportFormOptions } from "@/lib/public-support-form";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return publicSupportFormOptions(request);
}

export async function POST(request: NextRequest) {
  return handlePublicSupportForm(request, "support");
}
