import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Toaster } from "sonner";
import { CockpitProviders } from "@/components/providers/cockpit-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gando · Cockpit",
  description: "Les outils Gando réunis dans un même Cockpit.",
  icons: {
    icon: [{ url: "/icon.svg?v=20260921", type: "image/svg+xml" }],
    shortcut: "/icon.svg?v=20260921",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`}
        </Script>
        <CockpitProviders>{children}</CockpitProviders>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
