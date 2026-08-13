// Config centrale des statuts de RDV, partagée entre Meetings et Agenda.
// Pour créer un statut : ajoute une entrée dans MEETING_STATUSES avec une clé
// unique, un libellé, des classes de badge et une couleur de pastille.
// IMPORTANT : la clé doit exister comme option de la propriété HubSpot
// `hs_meeting_outcome`, sinon l'enregistrement côté HubSpot sera refusé.

export type MeetingStatus = {
  key: string;
  label: string;
  badge: string;
  dot: string;
};

export const MEETING_STATUSES: MeetingStatus[] = [
  { key: "SCHEDULED", label: "Planifié", badge: "border-sky-400/30 bg-sky-400/10 text-sky-300", dot: "bg-sky-400" },
  { key: "RESCHEDULED", label: "Reporté", badge: "border-amber-400/30 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  { key: "COMPLETED", label: "Terminé", badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", dot: "bg-emerald-400" },
  { key: "NO_SHOW", label: "No show", badge: "border-rose-400/30 bg-rose-400/10 text-rose-300", dot: "bg-rose-400" },
  { key: "CANCELED", label: "Annulé", badge: "border-rose-400/30 bg-rose-400/10 text-rose-300", dot: "bg-rose-400" },
];

export function meetingStatus(key?: string | null) {
  return MEETING_STATUSES.find(s => s.key === key) ?? null;
}

export function meetingStatusLabel(key?: string | null) {
  return meetingStatus(key)?.label ?? key ?? "Sans statut";
}

export function meetingStatusBadge(key?: string | null) {
  return meetingStatus(key)?.badge ?? "border-white/10 bg-muted text-muted-foreground";
}

export function meetingStatusDot(key?: string | null) {
  return meetingStatus(key)?.dot ?? "bg-muted-foreground";
}
