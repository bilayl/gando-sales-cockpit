import type { ReactNode } from "react";
import { SettingsSidebar } from "@/components/settings-sidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <SettingsSidebar />
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[980px]">{children}</div>
      </div>
    </div>
  );
}
