import { SDRoomWorkspace } from "@/components/sd-room-workspace";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SDRoomWorkspace dealId={id} />;
}
