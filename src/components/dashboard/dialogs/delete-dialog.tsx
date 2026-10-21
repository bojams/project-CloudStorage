"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteItemAction,
  restoreItemAction,
} from "@/lib/actions/folders";
import { permanentlyDeleteItemAction } from "@/lib/actions/trash";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DriveMode } from "@/components/dashboard/item-menu";
import type { DriveItem } from "@/types";

interface DeleteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: DriveItem | null;
  readonly mode: DriveMode;
}

export function DeleteDialog({
  open,
  onOpenChange,
  item,
  mode,
}: DeleteDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!item) return;

    startTransition(async () => {
      const result =
        mode === "trash"
          ? await permanentlyDeleteItemAction({
              id: item.id,
              target: item.type,
              permanent: true,
            })
          : await deleteItemAction({
              id: item.id,
              target: item.type,
              permanent: false,
            });

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success(
        mode === "trash" ? "Permanently deleted" : "Moved to trash",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "trash" ? "Delete permanently?" : "Move to trash?"}
          </DialogTitle>
          <DialogDescription>
            {mode === "trash" ? (
              <>
                &quot;{item?.name}&quot; will be permanently removed. This action
                cannot be undone.
              </>
            ) : (
              <>
                &quot;{item?.name}&quot; will be moved to the trash. You can restore
                it later.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

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
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending
              ? "Working…"
              : mode === "trash"
                ? "Delete permanently"
                : "Move to trash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RestoreDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: DriveItem | null;
}

export function RestoreDialog({
  open,
  onOpenChange,
  item,
}: RestoreDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!item) return;

    startTransition(async () => {
      const result = await restoreItemAction({
        id: item.id,
        target: item.type,
      });

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success(`"${item.name}" restored`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore item</DialogTitle>
          <DialogDescription>
            &quot;{item?.name}&quot; will be restored to its original location.
          </DialogDescription>
        </DialogHeader>

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
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Restoring…" : "Restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
