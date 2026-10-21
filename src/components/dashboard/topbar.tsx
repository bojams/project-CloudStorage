"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SessionUser, StorageUsage } from "@/types";

interface TopBarProps {
  readonly user: SessionUser;
  readonly usage: StorageUsage;
  readonly title?: string;
}

/**
 * Application top bar: navigation trigger, search and appearance switch.
 */
export function TopBar({ user, usage, title }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
  }, [pathname]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams(window.location.search);
    params.delete("action");

    if (trimmed) params.set("q", trimmed);
    else params.delete("q");

    const search = params.toString();
    router.replace(`${pathname}${search ? `?${search}` : ""}`);
  }

  return (
    <header className="glass sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 px-3 sm:px-5">
      <MobileNav user={user} usage={usage} />

      {title ? (
        <h1 className="hidden text-sm font-semibold tracking-tight text-foreground md:block">
          {title}
        </h1>
      ) : null}

      <form onSubmit={handleSubmit} className="ml-auto flex-1 sm:ml-0 sm:max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this folder…"
            aria-label="Search files"
            className={cn("h-9 bg-muted/40 pl-9 pr-9")}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                const params = new URLSearchParams(window.location.search);
                params.delete("q");
                const search = params.toString();
                router.replace(`${pathname}${search ? `?${search}` : ""}`);
              }}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </form>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
