"use client";

import { History, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  completeVersionUploadAction,
  deleteFileVersionAction,
  listFileVersionsAction,
  requestVersionUploadAction,
  restoreFileVersionAction,
} from "@/lib/actions/versions";
import { uploadWithProgress } from "@/lib/client/upload";
import { PLANS } from "@/lib/plans";
import { isAllowedMimeType } from "@/lib/security/mime";
import { formatBytes, formatDateTime } from "@/lib/utils";
import type { DriveItem, FileVersionSummary } from "@/types";

interface VersionHistoryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: DriveItem | null;
  readonly isPremium: boolean;
}

interface CurrentVersion {
  readonly size: number;
  readonly mimeType: string;
  readonly updatedAt: string;
}

/**
 * Version history of a file (premium).
 *
 * A new revision is uploaded exactly like a regular file — the browser PUTs
 * the bytes to a signed grant — and the previous content is archived by the
 * server.
 */
export function VersionHistoryDialog({
  open,
  onOpenChange,
  item,
  isPremium,
}: VersionHistoryDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState<CurrentVersion | null>(null);
  const [versions, setVersions] = useState<FileVersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxFileSize =
    PLANS[isPremium ? "PREMIUM" : "FREE"].maxFileSizeBytes;

  const loadVersions = useCallback(async () => {
    if (!item) return;

    setIsLoading(true);

    const result = await listFileVersionsAction({ fileId: item.id });

    if (result.ok) {
      setCurrent(result.data.current);
      setVersions([...result.data.versions]);
    } else {
      toast.error(result.error.message);
    }

    setIsLoading(false);
  }, [item]);

  useEffect(() => {
    if (!open) return;
    void loadVersions();
  }, [open, loadVersions]);

  async function handleUpload(file: File) {
    if (!item) return;

    if (!isAllowedMimeType(file.type)) {
      toast.error("This file type cannot be uploaded.");
      return;
    }

    if (file.size > maxFileSize) {
      toast.error(
        `The revision is larger than ${Math.round(maxFileSize / (1024 * 1024))} MB.`,
      );
      return;
    }

    setProgress(0);

    const grantResult = await requestVersionUploadAction({
      fileId: item.id,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
    });

    if (!grantResult.ok) {
      setProgress(null);
      toast.error(grantResult.error.message);
      return;
    }

    const grant = grantResult.data;

    try {
      await uploadWithProgress(file, grant.url, grant.headers, setProgress);
    } catch (error) {
      setProgress(null);
      toast.error(
        error instanceof Error ? error.message : "The upload was interrupted.",
      );
      return;
    }

    const completeResult = await completeVersionUploadAction({
      fileId: item.id,
      versionId: grant.versionId,
      size: file.size,
    });

    setProgress(null);

    if (!completeResult.ok) {
      toast.error(completeResult.error.message);
      return;
    }

    toast.success("New revision uploaded");
    await loadVersions();
    router.refresh();
  }

  function handleRestore(version: FileVersionSummary) {
    if (!item) return;

    setBusyId(version.id);

    startTransition(async () => {
      const result = await restoreFileVersionAction({
        fileId: item.id,
        versionId: version.id,
      });

      setBusyId(null);

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success(`Revision ${version.versionNumber} restored`);
      await loadVersions();
      router.refresh();
    });
  }

  function handleDelete(version: FileVersionSummary) {
    if (!item) return;

    setBusyId(version.id);

    startTransition(async () => {
      const result = await deleteFileVersionAction({
        fileId: item.id,
        versionId: version.id,
      });

      setBusyId(null);

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success(`Revision ${version.versionNumber} deleted`);
      await loadVersions();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            Version history
          </DialogTitle>
          <DialogDescription>
            {item
              ? `Every revision of "${item.name}" is kept — restore an older one at any time.`
              : "Every revision of this file is kept."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="max-h-[45vh] pr-3">
            <div className="space-y-3">
              {current ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Current version
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(current.size)} ·{" "}
                        {formatDateTime(current.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {versions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No older revisions yet. Upload a new version to start the
                  history.
                </p>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Revision {version.versionNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(version.size)} ·{" "}
                        {formatDateTime(version.createdAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Restore this revision"
                        disabled={isPending || busyId === version.id}
                        onClick={() => handleRestore(version)}
                      >
                        {busyId === version.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Delete this revision"
                        disabled={isPending || busyId === version.id}
                        onClick={() => handleDelete(version)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        {progress !== null ? (
          <div className="space-y-2">
            <Separator />
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              Uploading the new revision… {progress}%
            </p>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleUpload(file);
          }}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="gradient"
            disabled={!item || progress !== null}
            onClick={() => inputRef.current?.click()}
          >
            {progress !== null ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
