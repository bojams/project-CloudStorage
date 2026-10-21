"use client";

import { motion } from "framer-motion";
import { HardDrive } from "lucide-react";

import { formatBytes, formatPercent } from "@/lib/utils";

interface StorageIndicatorProps {
  readonly used: number;
  readonly quota: number;
  readonly fileCount: number;
  readonly compact?: boolean;
}

/**
 * Storage usage meter. The bar animates smoothly whenever the usage
 * changes, which makes the component feel alive without being noisy.
 */
export function StorageIndicator({
  used,
  quota,
  fileCount,
  compact = false,
}: StorageIndicatorProps) {
  const percent = formatPercent(used, quota);

  const barColor =
    percent >= 90
      ? "bg-destructive"
      : percent >= 70
        ? "bg-warning"
        : "bg-primary";

  if (compact) {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Storage</span>
          <span className="font-medium tabular-nums text-foreground">
            {percent}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3.5 shadow-xs">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <HardDrive className="size-3.5" />
          Storage
        </span>
        <span className="text-xs font-medium tabular-nums text-foreground">
          {percent}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
        <span className="font-medium text-foreground">{formatBytes(used)}</span> of{" "}
        {formatBytes(quota)} used · {fileCount}{" "}
        {fileCount === 1 ? "file" : "files"}
      </p>
    </div>
  );
}
