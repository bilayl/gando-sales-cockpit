import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0">
          <div className="lg:sticky lg:top-16">
            <SettingsNav />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
