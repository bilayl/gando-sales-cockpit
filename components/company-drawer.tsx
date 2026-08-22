"use client";

import { useState } from "react";
import { CompanyDrawer as CompanyDrawerBase } from "@/components/company-drawer-base";
import { ProfileSourcingOverlay } from "@/components/profile-sourcing-overlay";

type Props = {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CompanyDrawer(props: Props) {
  const { companyId, open } = props;
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <CompanyDrawerBase key={`${companyId || "none"}-${refreshKey}`} {...props} />
      <ProfileSourcingOverlay
        open={open}
        entityType="company"
        entityId={companyId}
        onCompleted={() => setRefreshKey(value => value + 1)}
      />
    </>
  );
}
