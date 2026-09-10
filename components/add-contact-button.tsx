"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewContactDialog } from "@/components/new-contact-dialog";

export function AddContactButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={`h-9 gap-1.5 ${className}`} onClick={() => setOpen(true)}>
        <UserPlus size={14} /> Ajouter un contact
      </Button>
      <NewContactDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          if (pathname.startsWith("/prospection")) window.location.reload();
          else router.refresh();
        }}
      />
    </>
  );
}
