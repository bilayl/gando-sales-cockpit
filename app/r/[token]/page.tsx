import { PublicSDRoomV3 } from "@/components/public-sd-room-v3";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="public-room-client-title">
      <style>{`
        .public-room-client-title main > section > div.relative.z-10 > div.mt-8 > div:first-child {
          display: none;
        }
        .public-room-client-title main > section > div.relative.z-10 > div.mt-8 > h1 {
          margin-top: 0;
        }
      `}</style>
      <PublicSDRoomV3 token={token} />
    </div>
  );
}
