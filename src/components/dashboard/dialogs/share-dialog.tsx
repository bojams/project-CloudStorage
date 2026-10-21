"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { createShareAction, revokeShareAction } from "@/lib/actions/shares";
import { listSharesAction } from "@/lib/actions/trash";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { DriveItem, ShareSummary } from "@/types";

interface ShareDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: DriveItem | null;
}

/**
 * Share dialog: creates a link share and/or invites a registered user.
 */
export function ShareDialog({
  open,
  onOpenChange,
  item,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [shares, setShares] = useState<ShareSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !item) return;

    let cancelled = false;

    void listSharesAction(item.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setShares(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [open, item]);

  async function handleCopy(share: ShareSummary) {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopiedId(share.id);
      window.setTimeout(() => setCopiedId(null), 2000);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not copy the link. Please copy it manually.");
    }
  }

  function handleCreate() {
    if (!item) return;

    setError(null);

    startTransition(async () => {
      const result = await createShareAction({
        targetId: item.id,
        target: item.type,
        permission,
        recipientEmail: email.trim() ? email.trim() : null,
        expiresInDays: null,
        note: null,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      toast.success("Share link created");
      setEmail("");
      setShares((current) => [result.data, ...current]);
    });
  }

  function handleRevoke(shareId: string) {
    startTransition(async () => {
      const result = await revokeShareAction({ shareId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setShares((current) => current.filter((share) => share.id !== shareId));
      toast.success("Share revoked");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4 text-primary" />
            Share &quot;{item?.name}&quot;
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can access this item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="share-email">Invite by email</Label>
              <Input
                id="share-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-permission">Permission</Label>
              <Select
                value={permission}
                onValueChange={(value) =>
                  setPermission(value === "EDIT" ? "EDIT" : "VIEW")
                }
              >
                <SelectTrigger id="share-permission" className="w-[8.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEW">Can view</SelectItem>
                  <SelectItem value="EDIT">Can edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <p className="text-xs font-medium text-destructive">{error}</p>
          ) : null}

          <Button
            type="button"
            variant="gradient"
            className="w-full"
            onClick={handleCreate}
            disabled={isPending}
          >
            <Link2 className="size-4" />
            {isPending ? "Creating…" : "Create share link"}
          </Button>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active links
            </p>

            {shares.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No active share links yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {shares.map((share) => (
                  <li
                    key={share.id}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {share.recipientEmail ?? "Anyone with the link"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {share.url}
                      </p>
                    </div>
                    <Badge variant="outline">{share.permission}</Badge>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => void handleCopy(share)}
                      aria-label="Copy link"
                    >
                      {copiedId === share.id ? (
                        <Check className="size-4 text-success" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRevoke(share.id)}
                      aria-label="Revoke link"
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
