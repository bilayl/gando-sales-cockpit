"use client";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewTransition = { finished: Promise<void> };
type VTDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition | void;
};

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback((e?: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const rect = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-radius", `${radius}px`);

    const apply = () => {
      const next = !root.classList.contains("dark");
      root.classList.toggle("dark", next);
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      setDark(next);
    };

    const doc = document as VTDocument;
    if (typeof doc.startViewTransition === "function") {
      try {
        const t = doc.startViewTransition(() => {
          root.classList.add("theme-vt");
          apply();
        });
        const reenable = () => root.classList.remove("theme-vt");
        if (t && typeof t.finished?.then === "function") {
          t.finished.then(reenable).catch(reenable);
        } else {
          window.setTimeout(reenable, 600);
        }
        return;
      } catch {
        /* a transition is already running → fall through */
        root.classList.remove("theme-vt");
      }
    }

    apply();
    document.body.classList.remove("theme-switching");
    void document.body.offsetWidth;
    document.body.classList.add("theme-switching");
    window.setTimeout(() => document.body.classList.remove("theme-switching"), 600);
  }, []);

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 overflow-hidden text-muted-foreground hover:text-violet-300" onClick={toggle} aria-label="Basculer le thème clair/sombre" title="Basculer le thème clair/sombre">
      <span key={dark ? "sun" : "moon"} className="animate-scale-in grid place-items-center">
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </span>
    </Button>
  );
}
