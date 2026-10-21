"use client";

import { Download, FileText, Pencil, Share2 } from "lucide-react";

import { FileIcon } from "@/components/dashboard/file-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMimeLabel } from "@/lib/security/mime";
import { formatBytes, formatDateTime } from "@/lib/utils";
import type { DriveItem } from "@/types";

interface PreviewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: DriveItem | null;
  readonly onShare: (item: DriveItem) => void;
  readonly onRename: (item: DriveItem) => void;
}

/**
 * File preview sheet with the metadata and the primary actions.
 */
export function PreviewDialog({
  open,
  onOpenChange,
  item,
  onShare,
  onRename,
}: PreviewDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 break-all">{item.name}</DialogTitle>
          <DialogDescription>File details</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background/60 px-6 py-8">
          <FileIcon
            mimeType={item.mimeType}
            isFolder={item.type === "folder"}
            className="size-20 rounded-2xl"
            iconClassName="size-10"
          />
          <dl className="grid w-full grid-cols-2 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="text-right font-medium text-foreground">
              {item.mimeType ? getMimeLabel(item.mimeType) : "Folder"}
            </dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd className="text-right font-medium tabular-nums text-foreground">
              {item.type === "folder" ? "—" : formatBytes(item.size)}
            </dd>
            <dt className="text-muted-foreground">Modified</dt>
            <dd className="text-right font-medium text-foreground">
              {formatDateTime(item.updatedAt)}
            </dd>
          </dl>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onRename(item)}
            className="text-muted-foreground"
          >
            <Pencil className="size-4" />
            Rename
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onShare(item)}>
              <Share2 className="size-4" />
              Share
            </Button>
            <Button asChild variant="gradient">
              <a href={`/api/files/${item.id}/download`} download>
                <Download className="size-4" />
                Download
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { FileText };
