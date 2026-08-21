"use client";

import { GandoMark } from "@/components/gando-mark";
import type { SDRoomBrandTheme } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

export const SD_ROOM_BANNER_THEMES: Array<{ value: SDRoomBrandTheme; label: string; preview: string }> = [
  { value: "gando", label: "Gando violet", preview: "from-[#7664ef] via-[#907ff4] to-[#a99bf6]" },
  { value: "gradient", label: "Gradient fort", preview: "from-[#5238d4] via-[#7c65ef] to-[#ad9cf7]" },
  { value: "dark", label: "Dark", preview: "from-[#14272e] via-[#273b49] to-[#10191d]" },
  { value: "light", label: "Light", preview: "from-[#f4f0ff] via-[#e8e2ff] to-[#d8d0ff]" },
];

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "CL";
}

function ClientLogo({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-white bg-white shadow-xl"><img src={url} alt={`Logo ${name}`} className="h-full w-full object-contain p-2" /></div>;
  }
  return <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-white bg-white text-lg font-black text-[#4d39b8] shadow-xl">{initials(name)}</div>;
}

export function SDRoomBrandBanner({
  companyName,
  logoUrl,
  bannerUrl,
  theme,
  title,
  subtitle,
  className,
}: {
  companyName: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  theme: SDRoomBrandTheme;
  title?: string | null;
  subtitle?: string | null;
  className?: string;
}) {
  const selected = SD_ROOM_BANNER_THEMES.find(item => item.value === theme) || SD_ROOM_BANNER_THEMES[0];
  const light = theme === "light";

  return (
    <section
      className={cn("relative isolate w-full overflow-hidden bg-gradient-to-br px-6 !pb-6 !pt-8 !min-h-[260px] sm:!pb-8 sm:!pt-10 sm:!min-h-[300px] shadow-[0_22px_60px_rgba(73,54,160,0.16)]", selected.preview, className)}
      style={bannerUrl ? { backgroundImage: `linear-gradient(110deg, rgba(87,64,211,.84), rgba(157,139,245,.74)), url(${bannerUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
    >
      <div className="pointer-events-none absolute -left-20 -top-24 h-52 w-[75%] rotate-[8deg] rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 right-[-10%] h-40 w-[70%] -rotate-[8deg] rounded-full bg-[#5a41dc]/20" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-7">
          <ClientLogo name={companyName || "Client"} url={logoUrl} />
          <span className={cn("text-4xl font-black", light ? "text-[#172a32]" : "text-white")}>×</span>
          <GandoMark className="h-20 w-20" />
        </div>
        <div className={cn("mt-4 text-[9px] font-black uppercase tracking-[0.18em]", light ? "text-[#4d39b8]" : "text-white/70")}>Gando Deal Room</div>
        <div className={cn("mt-1.5 text-xl font-black tracking-[-0.035em]", light ? "text-[#172a32]" : "text-white")}>{title || `${companyName || "Client"} × Gando`}</div>
        <div className={cn("mt-1.5 max-w-xl text-xs leading-5", light ? "text-[#637278]" : "text-white/75")}>{subtitle || "Espace de collaboration stratégique"}</div>
      </div>
    </section>
  );
}
