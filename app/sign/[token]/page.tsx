import { SD05SignaturePortal } from "@/components/sd05-signature-portal";

export const dynamic = "force-dynamic";

export default async function SD05SignaturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SD05SignaturePortal token={token} />;
}
