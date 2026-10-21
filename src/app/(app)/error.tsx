"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

/**
 * Route-level error boundary — a crash never shows a raw stack trace to the
 * user, and the digest is printed so the failure can be correlated with the
 * server logs.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The request could not be completed. Your data is safe — try again, and
          if the problem persists, sign out and back in.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="gradient" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.assign("/drive")}>
          Go to my drive
        </Button>
      </div>
    </div>
  );
}
