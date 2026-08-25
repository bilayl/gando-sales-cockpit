"use client";

import { useState } from "react";
import { ContactDrawer as ContactDrawerBase } from "@/components/contact-drawer-base";
import { ProfileSourcingOverlay } from "@/components/profile-sourcing-overlay";

type Props = {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

const PROSPECTION_DIRTY_KEY = "gando:prospection-company-dirty";

export function ContactDrawer(props: Props) {
  const { contactId, open, onUpdated } = props;
  const [refreshKey, setRefreshKey] = useState(0);

  function flagProspectionRefresh() {
    if (typeof window !== "undefined") window.sessionStorage.setItem(PROSPECTION_DIRTY_KEY, "1");
  }

  async function handleCompleted() {
    setRefreshKey(value => value + 1);
    flagProspectionRefresh();
    onUpdated?.();
  }

  function handleUpdated() {
    flagProspectionRefresh();
    onUpdated?.();
  }

  return (
    <>
      <ContactDrawerBase
        key={`${contactId || "none"}-${refreshKey}`}
        {...props}
        onUpdated={handleUpdated}
      />
      <ProfileSourcingOverlay
        open={open}
        entityType="contact"
        entityId={contactId}
        onCompleted={handleCompleted}
      />
    </>
  );
}
