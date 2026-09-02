import type { ReactNode } from "react";

export default function PublicRoomLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-room-light min-h-screen bg-[#f5f6f7] text-[#172126]" style={{ colorScheme: "light" }}>
      <style>{`
        .public-room-light input,
        .public-room-light textarea,
        .public-room-light select {
          color: #172126 !important;
          -webkit-text-fill-color: #172126 !important;
          caret-color: #172126 !important;
        }

        .public-room-light input::placeholder,
        .public-room-light textarea::placeholder {
          color: #8a9499 !important;
          -webkit-text-fill-color: #8a9499 !important;
          opacity: 1;
        }

        .public-room-light input:-webkit-autofill,
        .public-room-light input:-webkit-autofill:hover,
        .public-room-light input:-webkit-autofill:focus,
        .public-room-light textarea:-webkit-autofill,
        .public-room-light select:-webkit-autofill {
          -webkit-text-fill-color: #172126 !important;
          caret-color: #172126 !important;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          box-shadow: 0 0 0 1000px #ffffff inset !important;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>
      {children}
    </div>
  );
}
