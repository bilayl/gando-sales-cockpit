"use client";

import { useState } from "react";
import { Download, Headphones, Loader2, PauseCircle } from "lucide-react";

export function WithAlloRecordingPlayer({ callId }: { callId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const src = "/api/withallo/recordings/" + encodeURIComponent(callId);
  async function showPlayer() {
    if (open) { setOpen(false); return; }
    setBusy(true);
    setError("");
    try {
      // First validate Allo availability and the logged-in user's permission.
      const response = await fetch(src + "?check=1", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Cet enregistrement est indisponible.");
      setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'ouvrir cet enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void showPlayer()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : open ? <PauseCircle size={14} /> : <Headphones size={14} />}
          {open ? "Masquer le lecteur" : "Écouter l'enregistrement"}
        </button>
        {open ? <a href={src + "?download=1"} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted"><Download size={14}/> Télécharger MP3</a> : null}
        <span className="text-[10px] text-muted-foreground">Audio enregistré par Allo · accès privé</span>
      </div>
      {open ? (
        <audio
          controls
          preload="metadata"
          src={src}
          className="w-full max-w-[520px]"
          onError={() => setError("La lecture n'a pas pu démarrer. Vérifiez l'accès à l'enregistrement Allo ou réessayez.")}
        >
          Votre navigateur ne prend pas en charge la lecture audio.
        </audio>
      ) : null}
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
