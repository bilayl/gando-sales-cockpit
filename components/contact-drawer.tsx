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

export function ContactDrawer(props: Props) {
  const { contactId, open, onUpdated } = props;
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleCompleted() {
    setRefreshKey(value => value + 1);
    onUpdated?.();
  }

  return (
    <>
      <ContactDrawerBase key={`${contactId || "none"}-${refreshKey}`} {...props} />
      <ProfileSourcingOverlay
        open={open}
        entityType="contact"
        entityId={contactId}
        onCompleted={handleCompleted}
      />
    </>
  );
}
