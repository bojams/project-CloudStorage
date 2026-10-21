"use client";

import { Download, Folder as FolderIcon, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FileIcon } from "@/components/dashboard/file-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";

interface PublicShareItem {
  readonly id: string;
  readonly name: string;
  readonly kind: "file" | "folder";
  readonly mimeType: string | null;
  readonly size: number;
}

export interface PublicSharePayload {
  readonly kind: "file" | "folder";
  readonly name: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly token: string;
  readonly ownerName: string;
  readonly permission: "VIEW" | "EDIT";
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly items?: readonly PublicShareItem[];
}

/**
 * Read-only view of a shared file or folder.
 */
export function PublicShareView({ share }: { share: PublicSharePayload }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const items = share.items ?? [];

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/public/share/${share.token}/download`,
        { method: "GET" },
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = share.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Download started");
    } catch {
      toast.error("The file could not be downloaded.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-2xl shadow-black/10 backdrop-blur">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
          {share.kind === "file" ? (
            <FileIcon iconClassName="size-7" />
          ) : (
            <FolderIcon className="size-7" />
          )}
        </div>
        <CardTitle className="break-all">{share.name}</CardTitle>
        <CardDescription>
          {share.kind === "file"
            ? `${formatBytes(share.size ?? 0)} · ${share.mimeType ?? "unknown type"}`
            : `${items.length} item${items.length === 1 ? "" : "s"} shared with you`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {share.kind === "file" ? (
          <Button
            variant="gradient"
            className="w-full"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {isDownloading ? "Preparing…" : "Download file"}
          </Button>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                This folder is empty.
              </li>
            ) : (
              items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 bg-card/40 px-4 py-2.5"
                >
                  {item.kind === "folder" ? (
                    <FolderIcon className="size-4 shrink-0 text-amber-500" />
                  ) : (
                    <FileIcon
                      mimeType={item.mimeType}
                      className="size-6 shrink-0 rounded-md"
                      iconClassName="size-3.5"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.name}
                  </span>
                  {item.kind === "file" ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(item.size)}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        )}

        <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            Unguessable link
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" />
            Read-only access
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
