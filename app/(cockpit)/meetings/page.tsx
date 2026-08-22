import { MeetingsView } from "@/components/meetings-view";

export default function MeetingsPage() {
  return (
    <div className="meetings-without-gando-presentations">
      <MeetingsView />
      <style>{`
        .meetings-without-gando-presentations [role="tablist"][aria-label="Vues de rendez-vous"] > button:last-child {
          display: none !important;
        }
        .meetings-without-gando-presentations section[aria-label="Indicateurs rendez-vous"] > :last-child {
          display: none !important;
        }
        @media (min-width: 1280px) {
          .meetings-without-gando-presentations section[aria-label="Indicateurs rendez-vous"] {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
