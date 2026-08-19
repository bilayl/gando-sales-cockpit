import { SDRoomEditor } from "@/components/sd-room-editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SDRoomEditor dealId={id} />;
}
