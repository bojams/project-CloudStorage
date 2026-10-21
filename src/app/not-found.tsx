import { CloudOff } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Friendly 404 page — used for unknown routes and for links that have
 * expired or been revoked.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-60" />
      <div className="pointer-events-none absolute -left-32 -top-32 size-[24rem] rounded-full bg-primary/15 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-5">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <CloudOff className="size-6" />
        </span>

        <div>
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            This page could not be found
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The file may have been moved, the share link may have expired, or the
            address may be incorrect.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="gradient" asChild>
            <Link href="/drive">Back to my drive</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
