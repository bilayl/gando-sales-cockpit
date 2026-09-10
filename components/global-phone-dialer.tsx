"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Delete, ExternalLink, Phone, X } from "lucide-react";

const ONOFF_CHROME_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";

type Country = {
  code: string;
  label: string;
  flag: string;
  prefix: string;
};

const COUNTRIES: Country[] = [
  { code: "FR", label: "France", flag: "🇫🇷", prefix: "+33" },
  { code: "GP", label: "Guadeloupe", flag: "🇬🇵", prefix: "+590" },
  { code: "MQ", label: "Martinique", flag: "🇲🇶", prefix: "+596" },
  { code: "GF", label: "Guyane", flag: "🇬🇫", prefix: "+594" },
  { code: "RE", label: "La Réunion", flag: "🇷🇪", prefix: "+262" },
  { code: "BE", label: "Belgique", flag: "🇧🇪", prefix: "+32" },
  { code: "CH", label: "Suisse", flag: "🇨🇭", prefix: "+41" },
  { code: "GB", label: "Royaume-Uni", flag: "🇬🇧", prefix: "+44" },
  { code: "US", label: "États-Unis / Canada", flag: "🇺🇸", prefix: "+1" },
];

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function normalizeNumber(raw: string, prefix: string) {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  if (!compact) return "";
  if (compact.includes("*") || compact.includes("#")) return compact;
  if (compact.startsWith("+")) return `+${compact.slice(1).replace(/\D/g, "")}`;
  const digits = compact.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `${prefix}${digits.slice(1)}`;
  return `${prefix}${digits}`;
}

export function GlobalPhoneDialer() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [countryCode, setCountryCode] = useState("FR");
  const [error, setError] = useState("");

  const country = useMemo(() => COUNTRIES.find(item => item.code === countryCode) || COUNTRIES[0], [countryCode]);
  const normalized = useMemo(() => normalizeNumber(number, country.prefix), [number, country.prefix]);
  const callable = Boolean(normalized && !normalized.includes("*") && !normalized.includes("#"));

  useEffect(() => {
    function openFromEvent(event: Event) {
      const custom = event as CustomEvent<{ phone?: string }>;
      setNumber(custom.detail?.phone || "");
      setError("");
      setOpen(true);
    }

    window.addEventListener("gando:open-dialer", openFromEvent as EventListener);
    return () => window.removeEventListener("gando:open-dialer", openFromEvent as EventListener);
  }, []);

  function append(value: string) {
    setNumber(current => `${current}${value}`);
    setError("");
  }

  function erase() {
    setNumber(current => current.slice(0, -1));
    setError("");
  }

  function launchFromKeyboard() {
    if (!callable) {
      setError("Entrez un numéro de téléphone valide.");
      return;
    }
    setOpen(false);
    window.location.href = `tel:${normalized}`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        className="fixed bottom-6 right-6 z-[55] grid h-12 w-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-[0_8px_28px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-muted"
        aria-label="Ouvrir le dialer"
        title="Dialer"
      >
        <Phone className="h-5 w-5" strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Dialer">
          <div className="relative w-full max-w-[520px] rounded-[26px] border border-border bg-card px-8 pb-8 pt-7 text-card-foreground shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:px-12 sm:pb-10">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-7 pr-10">
              <div className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Téléphone</div>
              <div className="mt-1 text-[12px] text-muted-foreground">Composez ici, puis laissez Onoff Click2Call prendre en charge l’appel.</div>
            </div>

            <div className="flex h-[58px] overflow-hidden rounded-[14px] border border-border bg-background">
              <div className="relative flex w-[116px] shrink-0 items-center border-r border-border px-4">
                <span className="text-[26px] leading-none">{country.flag}</span>
                <ChevronDown className="ml-auto h-4 w-4 text-foreground" />
                <select value={countryCode} onChange={event => setCountryCode(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Indicatif pays">
                  {COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.label} {item.prefix}</option>)}
                </select>
              </div>
              <input
                value={number}
                onChange={event => setNumber(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter") launchFromKeyboard(); }}
                autoFocus
                inputMode="tel"
                placeholder="Entrer un nom ou numéro"
                className="min-w-0 flex-1 bg-background px-5 text-[20px] font-normal text-foreground outline-none placeholder:text-muted-foreground sm:text-[22px]"
              />
              {number ? <button type="button" onClick={erase} className="grid w-12 shrink-0 place-items-center text-muted-foreground hover:text-foreground" aria-label="Effacer"><Delete className="h-5 w-5" /></button> : null}
            </div>

            <div className="mx-auto mt-8 grid max-w-[310px] grid-cols-3 gap-x-7 gap-y-5">
              {KEYS.map(key => (
                <button key={key} type="button" onClick={() => append(key)} className="grid aspect-square w-full max-w-[76px] place-items-center justify-self-center rounded-full bg-muted text-[30px] font-normal text-foreground transition hover:bg-accent active:scale-95">
                  {key === "0" ? <span className="flex flex-col items-center leading-none"><span>0</span><span className="mt-1 text-[13px] font-semibold text-muted-foreground">+</span></span> : key}
                </button>
              ))}
            </div>

            {error ? <div className="mx-auto mt-5 max-w-[390px] rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-2.5 text-center text-[12px] leading-5 text-destructive">{error}</div> : null}

            {callable ? (
              <a
                href={`tel:${normalized}`}
                onClick={() => window.setTimeout(() => setOpen(false), 0)}
                className="mx-auto mt-8 flex h-[58px] w-full max-w-[250px] items-center justify-center rounded-[18px] bg-[#79ca72] text-white transition hover:bg-[#6fc268]"
                aria-label={`Appeler ${normalized} avec Onoff`}
              >
                <Phone className="h-6 w-6 fill-current" />
              </a>
            ) : (
              <button type="button" disabled className="mx-auto mt-8 flex h-[58px] w-full max-w-[250px] cursor-not-allowed items-center justify-center rounded-[18px] bg-[#79ca72] text-white opacity-45">
                <Phone className="h-6 w-6 fill-current" />
              </button>
            )}

            <div className="mx-auto mt-4 max-w-[390px] text-center text-[11px] leading-5 text-muted-foreground">
              Le click-to-call s’appuie sur <strong className="font-semibold text-foreground">Onoff Business Click2Call</strong>. Pour le softphone complet, ouvre la rubrique Appels du Cockpit.
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <a href={ONOFF_CHROME_EXTENSION_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4">
                  Installer Onoff Click2Call <ExternalLink className="h-3 w-3" />
                </a>
                <a href="/phone" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4">
                  Ouvrir le webphone Gando
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
