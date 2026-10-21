"use client";

import { LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/types";

interface ViewToggleProps {
  readonly value: ViewMode;
  readonly onChange: (value: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
    >
      {(
        [
          { mode: "grid" as const, icon: LayoutGrid, label: "Grid view" },
          { mode: "list" as const, icon: List, label: "List view" },
        ]
      ).map(({ mode, icon: Icon, label }) => (
        <Button
          key={mode}
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={label}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            "rounded-md transition-colors",
            value === mode
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-background/60",
          )}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}
