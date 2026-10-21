"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { renameItemAction } from "@/lib/actions/folders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DriveItem } from "@/types";

interface RenameDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: DriveItem | null;
}

export function RenameDialog({
  open,
  onOpenChange,
  item,
}: RenameDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && item) {
      setName(item.name);
      setError(null);
    }
  }, [open, item]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;

    setError(null);

    startTransition(async () => {
      const result = await renameItemAction({
        id: item.id,
        target: item.type,
        name,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      toast.success(`Renamed to "${result.data.name}"`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>
            Choose a new name for this {item?.type ?? "item"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              maxLength={255}
              aria-invalid={error ? "true" : undefined}
            />
            {error ? (
              <p className="text-xs font-medium text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={isPending || !name.trim()}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
