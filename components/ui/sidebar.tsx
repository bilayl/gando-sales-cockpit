import * as React from "react"

import { cn } from "@/lib/utils"

export function SidebarProvider({ className, style, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-h-svh w-full bg-muted/35", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
}

export function SidebarInset({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn(
        "relative flex min-w-0 flex-1 flex-col bg-background lg:my-2 lg:mr-2 lg:min-h-[calc(100svh-1rem)] lg:rounded-2xl lg:border lg:border-border lg:shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  )
}
