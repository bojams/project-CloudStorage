import { ChevronRight, HardDrive } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Breadcrumb } from "@/types";

interface BreadcrumbsProps {
  readonly items: Breadcrumb[];
  readonly className?: string;
}

/**
 * Breadcrumb trail for the current folder.
 * Every ancestor is a real, UUID based link — folder names are never used
 * to build a URL, which keeps the routing free of path traversal issues.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-0.5 text-sm">
        <li className="flex items-center">
          <Link
            href="/drive"
            className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HardDrive className="size-4" />
            <span className="hidden sm:inline">My Drive</span>
          </Link>
        </li>

        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={crumb.id} className="flex items-center">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
              {isLast ? (
                <span
                  aria-current="page"
                  className="max-w-[14rem] truncate px-1.5 py-1 font-medium text-foreground"
                >
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={`/drive/${crumb.id}`}
                  className="max-w-[10rem] truncate rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
