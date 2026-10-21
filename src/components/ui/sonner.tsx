"use client";

import { Toaster as Sonner } from "sonner";

import { useTheme } from "@/components/providers/theme-provider";

/**
 * Toast notifications. The theme is synced with the app theme so toasts
 * remain readable in both light and dark mode.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-border bg-popover text-popover-foreground shadow-xl shadow-black/5",
          description: "text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground rounded-md text-xs font-medium px-2.5 py-1",
          cancelButton: "bg-muted text-muted-foreground rounded-md",
        },
      }}
    />
  );
}
