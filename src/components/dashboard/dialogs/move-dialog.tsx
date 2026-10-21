"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { moveItemAction, listFolderTreeAction } from "@/lib/actions/folders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DriveItem, FolderNode } from "@/types";

interface MoveDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: DriveItem | null;
}

/**
 * Move dialog.
 *
 * The destination is picked from the folder tree that is fetched from the
 * server on demand. Only UUIDs are used as identifiers — the raw folder name
 * never becomes part of a request path.
 */
export function MoveDialog({
  open,
  onOpenChange,
  item,
}: MoveDialogProps) {
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void listFolderTreeAction().then((result) => {
      if (cancelled) return;
      if (result.ok) setTree(result.data);
      else setError(result.error.message);
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  /** Folders that must be hidden: the item itself and its descendants. */
  const forbiddenIds = useMemo(() => {
    if (!item || item.type !== "folder") return new Set<string>();

    const forbidden = new Set<string>([item.id]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const node of tree) {
        if (
          node.parentId &&
          forbidden.has(node.parentId) &&
          !forbidden.has(node.id)
        ) {
          forbidden.add(node.id);
          changed = true;
        }
      }
    }

    return forbidden;
  }, [item, tree]);

  function handleMove() {
    if (!item) return;

    setError(null);

    startTransition(async () => {
      const result = await moveItemAction({
        id: item.id,
        target: item.type,
        destinationFolderId: selectedId,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      toast.success(`"${item.name}" moved`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Move &quot;{item?.name}&quot;</DialogTitle>
          <DialogDescription>
            Select a destination folder inside your drive.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-background/50 p-1.5 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent",
              selectedId === null ? "bg-accent text-accent-foreground" : "",
            )}
          >
            <HardDriveIcon />
            <span className="font-medium">My Drive</span>
          </button>

          {tree.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No folders available.
            </p>
          ) : (
            tree
              .filter((node) => !forbiddenIds.has(node.id))
              .map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 pl-8 text-left text-sm transition-colors hover:bg-accent",
                    selectedId === node.id
                      ? "bg-accent text-accent-foreground"
                      : "",
                  )}
                >
                  <FolderGlyph />
                  <span className="truncate">{node.name}</span>
                </button>
              ))
          )}
        </div>

        {error ? (
          <p className="text-xs font-medium text-destructive">{error}</p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="gradient"
            onClick={handleMove}
            disabled={isPending}
          >
            {isPending ? "Moving…" : "Move here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HardDriveIcon() {
  return (
    <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 text-primary">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-3.5"
        aria-hidden="true"
      >
        <path d="M3 7h18M5 7l1.5 12h11L19 7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function FolderGlyph() {
  return (
    <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 text-primary">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-3.5"
        aria-hidden="true"
      >
        <path
          d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
