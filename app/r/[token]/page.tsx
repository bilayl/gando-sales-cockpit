import { PublicSDRoom } from "@/components/public-sd-room";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSDRoom token={token} />;
}
