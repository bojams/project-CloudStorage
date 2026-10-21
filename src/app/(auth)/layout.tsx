import type { ReactNode } from "react";

import { Cloud } from "lucide-react";

/**
 * Layout for the authentication screens: a calm, centred card on a soft
 * gradient background.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-60" />
      <div className="pointer-events-none absolute -left-40 -top-40 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 size-[26rem] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
            <Cloud className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Nimbus Drive
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your files, encrypted and always within reach.
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
