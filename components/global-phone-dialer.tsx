"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Delete, Loader2, Phone, X } from "lucide-react"
import { InWebCallWorkspace } from "@/components/in-web-call-workspace"

type Country = {
  code: string
  label: string
  flag: string
  prefix: string
}

type AlloStatus = {
  configured?: boolean
  connected?: boolean
  powerDialerReady?: boolean
  directCallReady?: boolean
  team?: { name?: string } | null
  target?: { email?: string | null; name?: string | null } | null
}

type DialerContact = {
  id: string
  properties: Record<string, string | null | undefined>
}

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
]

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

function normalizeNumber(raw: string, prefix: string) {
  const compact = raw.trim().replace(/[\s().-]/g, "")
  if (!compact) return ""
  if (compact.includes("*") || compact.includes("#")) return compact
  if (compact.startsWith("+")) return `+${compact.slice(1).replace(/\D/g, "")}`
  const digits = compact.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("00")) return `+${digits.slice(2)}`
  if (digits.startsWith("0")) return `${prefix}${digits.slice(1)}`
  return `${prefix}${digits}`
}

export function GlobalPhoneDialer() {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState("")
  const [countryCode, setCountryCode] = useState("FR")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [workspaceContact, setWorkspaceContact] = useState<DialerContact | null>(null)
  const [allo, setAllo] = useState<AlloStatus | null>(null)

  const country = useMemo(() => COUNTRIES.find(item => item.code === countryCode) || COUNTRIES[0], [countryCode])

  useEffect(() => {
    function interceptPhoneLinks(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target.closest('a[href^="tel:"]') : null
      if (!(element instanceof HTMLAnchorElement)) return
      const href = element.getAttribute("href") || ""
      const phone = decodeURIComponent(href.replace(/^tel:/i, ""))
      if (!phone) return
      event.preventDefault()
      setNumber(phone)
      setError("")
      setOpen(true)
    }

    function openFromEvent(event: Event) {
      const custom = event as CustomEvent<{ phone?: string }>
      setNumber(custom.detail?.phone || "")
      setError("")
      setOpen(true)
    }

    document.addEventListener("click", interceptPhoneLinks, true)
    window.addEventListener("gando:open-dialer", openFromEvent as EventListener)
    return () => {
      document.removeEventListener("click", interceptPhoneLinks, true)
      window.removeEventListener("gando:open-dialer", openFromEvent as EventListener)
    }
  }, [])

  function append(value: string) {
    setNumber(current => `${current}${value}`)
    setError("")
  }

  function erase() {
    setNumber(current => current.slice(0, -1))
    setError("")
  }

  async function startCall() {
    const normalized = normalizeNumber(number, country.prefix)
    if (!normalized) {
      setError("Entrez un numéro de téléphone.")
      return
    }
    if (normalized.includes("*") || normalized.includes("#")) {
      setError("Saisissez d’abord un numéro classique. Les touches * et # servent pendant un appel.")
      return
    }

    setLoading(true)
    setError("")
    try {
      const [statusResponse, queueResponse] = await Promise.all([
        fetch("/api/allo/status", { cache: "no-store" }),
        fetch("/api/allo/dialing-queue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ numbers: [{ number: normalized, name: "Appel manuel Cockpit" }] }),
        }),
      ])
      const statusPayload = await statusResponse.json().catch(() => ({}))
      const queuePayload = await queueResponse.json().catch(() => ({}))
      if (!queueResponse.ok) {
        throw new Error(queuePayload?.error?.message || queuePayload?.message || "Impossible d’envoyer ce numéro à Allo.")
      }

      setAllo(statusPayload)
      setWorkspaceContact({
        id: `manual-${Date.now()}`,
        properties: {
          firstname: "Appel manuel",
          phone: normalized,
          company: "Cockpit Gando",
          db_call_priority_label: "Numéro saisi manuellement",
          db_call_reason: "Appel lancé depuis le dialer global du Cockpit.",
        },
      })
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de préparer l’appel Allo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError("") }}
        className="fixed bottom-6 right-6 z-[55] grid h-12 w-12 place-items-center rounded-full border border-[#dfe5e1] bg-white text-[#26342e] shadow-[0_8px_28px_rgba(23,35,31,0.14)] transition hover:-translate-y-0.5 hover:bg-[#f8faf9]"
        aria-label="Ouvrir le dialer"
        title="Dialer"
      >
        <Phone className="h-5 w-5" strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Dialer">
          <div className="relative w-full max-w-[520px] rounded-[26px] border border-[#e5e8ea] bg-white px-8 pb-8 pt-7 shadow-[0_24px_80px_rgba(20,29,25,0.18)] sm:px-12 sm:pb-10">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-[#9aa0a8] transition hover:bg-[#f5f6f7] hover:text-[#263044]" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-7 pr-10">
              <div className="text-[18px] font-semibold tracking-[-0.02em] text-[#1f2937]">Téléphone</div>
              <div className="mt-1 text-[12px] text-[#8a919c]">Composez un numéro ou utilisez le bouton Appeler depuis n’importe quelle fiche.</div>
            </div>

            <div className="flex h-[58px] overflow-hidden rounded-[14px] border border-[#e2e5e9] bg-white">
              <div className="relative flex w-[116px] shrink-0 items-center border-r border-[#e2e5e9] px-4">
                <span className="text-[26px] leading-none">{country.flag}</span>
                <ChevronDown className="ml-auto h-4 w-4 text-[#30384a]" />
                <select value={countryCode} onChange={event => setCountryCode(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Indicatif pays">
                  {COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.label} {item.prefix}</option>)}
                </select>
              </div>
              <input
                value={number}
                onChange={event => setNumber(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter") void startCall() }}
                autoFocus
                inputMode="tel"
                placeholder="Entrer un nom ou numéro"
                className="min-w-0 flex-1 bg-white px-5 text-[20px] font-normal text-[#273044] outline-none placeholder:text-[#a1a6b0] sm:text-[22px]"
              />
              {number ? <button type="button" onClick={erase} className="grid w-12 shrink-0 place-items-center text-[#9299a4] hover:text-[#273044]" aria-label="Effacer"><Delete className="h-5 w-5" /></button> : null}
            </div>

            <div className="mx-auto mt-8 grid max-w-[310px] grid-cols-3 gap-x-7 gap-y-5">
              {KEYS.map(key => (
                <button key={key} type="button" onClick={() => append(key)} className="grid aspect-square w-full max-w-[76px] place-items-center justify-self-center rounded-full bg-[#f5f6f7] text-[30px] font-normal text-[#273044] transition hover:bg-[#eceef0] active:scale-95">
                  {key === "0" ? <span className="flex flex-col items-center leading-none"><span>0</span><span className="mt-1 text-[13px] font-semibold text-[#9da3ad]">+</span></span> : key}
                </button>
              ))}
            </div>

            {error ? <div className="mx-auto mt-5 max-w-[360px] rounded-xl bg-[#fff5f3] px-4 py-2.5 text-center text-[12px] leading-5 text-[#9b5449]">{error}</div> : null}

            <button
              type="button"
              onClick={() => void startCall()}
              disabled={loading || !number.trim()}
              className="mx-auto mt-8 flex h-[58px] w-full max-w-[250px] items-center justify-center rounded-[18px] bg-[#79ca72] text-white transition hover:bg-[#6fc268] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Phone className="h-6 w-6 fill-current" />}
            </button>
            <div className="mt-3 text-center text-[10px] text-[#9aa1aa]">Le numéro est synchronisé avec votre Power Dialer Allo.</div>
          </div>
        </div>
      ) : null}

      {workspaceContact ? (
        <InWebCallWorkspace contact={workspaceContact} allo={allo} onClose={() => setWorkspaceContact(null)} />
      ) : null}
    </>
  )
}
