"use client";

import { createPortal } from "react-dom";
import { ProfileSourcingButton } from "@/components/profile-sourcing-button";

type Props = {
  open: boolean;
  entityType: "company" | "contact";
  entityId: string | null;
  onCompleted?: () => void | Promise<void>;
};

export function ProfileSourcingOverlay({ open, entityType, entityId, onCompleted }: Props) {
  if (!open || !entityId || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[120] max-w-[calc(100vw-2.5rem)] rounded-xl border border-primary/20 bg-card/95 p-2 shadow-xl backdrop-blur sm:bottom-8 sm:right-8">
      <ProfileSourcingButton
        entityType={entityType}
        entityId={entityId}
        onCompleted={onCompleted}
        className="h-10 border-primary/25 bg-background shadow-sm hover:bg-accent"
        label={entityType === "company" ? "Enrichir entreprise + décideurs" : "Enrichir ce contact"}
      />
    </div>,
    document.body,
  );
}
