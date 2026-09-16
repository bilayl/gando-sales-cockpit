import { redirect } from "next/navigation";
import { DeveloperDocsEditor } from "@/components/developer-docs-editor";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  return <DeveloperDocsEditor />;
}
