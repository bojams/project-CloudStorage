"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import type { UploadTask } from "@/types";

interface UploadPanelProps {
  readonly tasks: UploadTask[];
  readonly onCancel: (taskId: string) => void;
  readonly onDismiss: (taskId: string) => void;
  readonly onClearFinished: () => void;
}

/**
 * Floating panel that shows the live upload queue with per-file progress.
 */
export function UploadPanel({
  tasks,
  onCancel,
  onDismiss,
  onClearFinished,
}: UploadPanelProps) {
  const active = tasks.filter(
    (task) => task.status === "queued" || task.status === "uploading" || task.status === "processing",
  );
  const finished = tasks.filter(
    (task) =>
      task.status === "completed" ||
      task.status === "failed" ||
      task.status === "canceled",
  );

  if (tasks.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="pointer-events-auto fixed bottom-5 right-5 z-50 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl shadow-black/10 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <UploadCloud className="size-4 text-primary" />
          <p className="flex-1 text-sm font-medium text-foreground">
            {active.length > 0
              ? `Uploading ${active.length} file${active.length > 1 ? "s" : ""}`
              : "Uploads"}
          </p>
          {finished.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onClearFinished}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto p-2 scrollbar-thin">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl px-2.5 py-2 transition-colors hover:bg-accent/50">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={task.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {task.fileName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {task.error ??
                          `${formatBytes(task.size)} · ${task.status === "processing" ? "Verifying…" : `${task.progress}%`}`}
                      </p>
                    </div>

                    {task.status === "uploading" ||
                    task.status === "queued" ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Cancel upload"
                        onClick={() => onCancel(task.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Dismiss"
                        onClick={() => onDismiss(task.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  {task.status === "uploading" ||
                  task.status === "processing" ? (
                    <Progress
                      value={task.progress}
                      className="mt-2"
                      indicatorClassName={
                        task.status === "processing" ? "bg-success" : undefined
                      }
                    />
                  ) : null}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}

function StatusIcon({ status }: { status: UploadTask["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 shrink-0 text-success" />;
  }
  if (status === "failed" || status === "canceled") {
    return <AlertCircle className="size-4 shrink-0 text-destructive" />;
  }
  return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
}
