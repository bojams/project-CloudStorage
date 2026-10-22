"use client";

import {
  ArrowDownAZ,
  Clock,
  FileUp,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  Plus,
  Ruler,
  Trash2,
  Upload,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FileGrid } from "@/components/dashboard/file-grid";
import { FileList } from "@/components/dashboard/file-list";
import type { DriveMode } from "@/components/dashboard/item-menu";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { UploadPanel } from "@/components/dashboard/upload-panel";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUploadManager } from "@/hooks/use-upload-manager";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Breadcrumb, DriveItem, SortDirection, SortKey, ViewMode } from "@/types";

/**
 * The dialogs are loaded on demand.
 *
 * Every dialog pulls in a sizeable amount of client side code (the share
 * dialog alone drags in the whole select primitive). Splitting them into
 * separate chunks keeps the initial payload of the drive small, which is what
 * the browser has to download and parse before the page becomes interactive.
 *
 * The loaders are shared with the idle preloading below, so warming them up
 * in the background reuses the exact same chunks.
 */
const loadNewFolderDialog = () =>
  import("@/components/dashboard/dialogs/new-folder-dialog");
const loadRenameDialog = () =>
  import("@/components/dashboard/dialogs/rename-dialog");
const loadMoveDialog = () =>
  import("@/components/dashboard/dialogs/move-dialog");
const loadShareDialog = () =>
  import("@/components/dashboard/dialogs/share-dialog");
const loadDeleteDialog = () =>
  import("@/components/dashboard/dialogs/delete-dialog");
const loadPreviewDialog = () =>
  import("@/components/dashboard/dialogs/preview-dialog");
const loadVersionHistoryDialog = () =>
  import("@/components/dashboard/dialogs/version-history-dialog");

const NewFolderDialog = dynamic(
  () => loadNewFolderDialog().then((module) => module.NewFolderDialog),
  { ssr: false },
);
const RenameDialog = dynamic(
  () => loadRenameDialog().then((module) => module.RenameDialog),
  { ssr: false },
);
const MoveDialog = dynamic(
  () => loadMoveDialog().then((module) => module.MoveDialog),
  { ssr: false },
);
const ShareDialog = dynamic(
  () => loadShareDialog().then((module) => module.ShareDialog),
  { ssr: false },
);
const DeleteDialog = dynamic(
  () => loadDeleteDialog().then((module) => module.DeleteDialog),
  { ssr: false },
);
const RestoreDialog = dynamic(
  () => loadDeleteDialog().then((module) => module.RestoreDialog),
  { ssr: false },
);
const PreviewDialog = dynamic(
  () => loadPreviewDialog().then((module) => module.PreviewDialog),
  { ssr: false },
);
const VersionHistoryDialog = dynamic(
  () => loadVersionHistoryDialog().then((module) => module.VersionHistoryDialog),
  { ssr: false },
);

const VIEW_STORAGE_KEY = "nimbus.drive.view";

interface DriveViewProps {
  readonly items: DriveItem[];
  readonly breadcrumbs: Breadcrumb[];
  readonly currentFolderId: string | null;
  readonly mode?: DriveMode;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly showToolbar?: boolean;
  /** Uploading is only possible inside folders the user owns. */
  readonly canUpload?: boolean;
  /** Whether the account may use the premium features. */
  readonly isPremium?: boolean;
  /** Maximum size of a single upload for the active plan. */
  readonly maxFileSizeBytes?: number;
}

export function DriveView({
  items,
  breadcrumbs,
  currentFolderId,
  mode = "drive",
  emptyTitle = "This folder is empty",
  emptyDescription = "Drag files here or upload them to get started.",
  showToolbar = true,
  canUpload = true,
  isPremium = false,
  maxFileSizeBytes = MAX_UPLOAD_SIZE,
}: DriveViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DriveItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<DriveItem | null>(null);
  const [shareTarget, setShareTarget] = useState<DriveItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DriveItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<DriveItem | null>(null);
  const [previewTarget, setPreviewTarget] = useState<DriveItem | null>(null);
  const [versionTarget, setVersionTarget] = useState<DriveItem | null>(null);

  const uploadManager = useUploadManager(
    () => router.refresh(),
    maxFileSizeBytes,
  );

  // Restore the persisted view preference once mounted.
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "list") setViewMode(stored);
  }, []);

  /**
   * Warm up the dialog chunks while the browser is idle.
   *
   * The dialogs are split out of the initial payload, but they still have to
   * be there the moment the user asks for them. Downloading them after the
   * page became interactive keeps the hard refresh fast and still opens the
   * dialogs without a visible delay.
   */
  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;

    // Respect the user's data saver — on a metered connection the chunks are
    // downloaded when a dialog is actually opened.
    if (connection?.saveData || connection?.effectiveType === "2g") return;

    const warmUp = () => {
      void loadNewFolderDialog();
      void loadRenameDialog();
      void loadMoveDialog();
      void loadShareDialog();
      void loadDeleteDialog();
      void loadPreviewDialog();
    };

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warmUp, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }

    const handle = window.setTimeout(warmUp, 1500);
    return () => window.clearTimeout(handle);
  }, []);

  /**
   * The sidebar lives outside the page tree, so it triggers actions through
   * the URL (`?action=new-folder` / `?action=upload`). The flag is consumed
   * once and removed from the address bar afterwards.
   */
  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;

    if (action === "new-folder") {
      setNewFolderOpen(true);
    }

    if (action === "upload") {
      window.setTimeout(() => fileInputRef.current?.click(), 0);
    }

    // Consume the flag so a reload does not repeat the action.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("action");
    const query = params.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [router, searchParams]);

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const sortedItems = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...items].sort((a, b) => {
      // Folders always come first.
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;

      switch (sortKey) {
        case "size":
          return (a.size - b.size) * direction;
        case "updatedAt":
        case "createdAt":
          return (
            (new Date(a.updatedAt).getTime() -
              new Date(b.updatedAt).getTime()) *
            direction
          );
        case "name":
        default:
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }) * direction;
      }
    });
  }, [items, sortKey, sortDirection]);

  const handleOpen = useCallback(
    (item: DriveItem) => {
      if (item.type === "folder") {
        router.push(`/drive/${item.id}`);
        return;
      }
      setPreviewTarget(item);
    },
    [router],
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      uploadManager.addFiles(files, currentFolderId);
    },
    [currentFolderId, uploadManager],
  );

  const actions = useMemo(
    () => ({
      onRename: setRenameTarget,
      onShare: setShareTarget,
      onMove: setMoveTarget,
      onDelete: setDeleteTarget,
      onRestore: setRestoreTarget,
      onVersions: setVersionTarget,
      isPremium,
    }),
    [isPremium],
  );

  return (
    <div className="flex min-h-full flex-col">
      {showToolbar ? (
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Breadcrumbs items={breadcrumbs} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mode === "drive" && canUpload ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length > 0) handleFilesSelected(files);
                    event.target.value = "";
                  }}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Upload
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewFolderOpen(true)}
                >
                  <FolderPlus className="size-4" />
                  New folder
                </Button>
              </>
            ) : null}

            <SortMenu
              sortKey={sortKey}
              sortDirection={sortDirection}
              onChange={(key, direction) => {
                setSortKey(key);
                setSortDirection(direction);
              }}
            />

            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      ) : null}

      <UploadDropzone
        onFiles={handleFilesSelected}
        disabled={mode !== "drive" || !canUpload}
      >
        {sortedItems.length === 0 ? (
          <EmptyState
            icon={mode === "trash" ? Trash2 : HardDrive}
            title={mode === "trash" ? "Trash is empty" : emptyTitle}
            description={
              mode === "trash"
                ? "Items you delete will appear here before they are permanently removed."
                : emptyDescription
            }
            action={
              mode === "drive" && canUpload ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="gradient"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="size-4" />
                    Upload files
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNewFolderOpen(true)}
                  >
                    <Plus className="size-4" />
                    New folder
                  </Button>
                </div>
              ) : null
            }
          />
        ) : (
          <div
            key={viewMode}
            className="animate-rise-in"
          >
            {viewMode === "grid" ? (
              <FileGrid
                items={sortedItems}
                mode={mode}
                actions={actions}
                onOpen={handleOpen}
              />
            ) : (
              <FileList
                items={sortedItems}
                mode={mode}
                actions={actions}
                onOpen={handleOpen}
              />
            )}
          </div>
        )}
      </UploadDropzone>

      <UploadPanel
        tasks={uploadManager.tasks}
        onCancel={uploadManager.cancel}
        onDismiss={uploadManager.dismiss}
        onClearFinished={uploadManager.clearFinished}
      />

      {newFolderOpen ? (
        <NewFolderDialog
          open
          onOpenChange={setNewFolderOpen}
          parentId={currentFolderId}
        />
      ) : null}

      {renameTarget ? (
        <RenameDialog
          open
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          item={renameTarget}
        />
      ) : null}

      {moveTarget ? (
        <MoveDialog
          open
          onOpenChange={(open) => {
            if (!open) setMoveTarget(null);
          }}
          item={moveTarget}
        />
      ) : null}

      {shareTarget ? (
        <ShareDialog
          open
          onOpenChange={(open) => {
            if (!open) setShareTarget(null);
          }}
          item={shareTarget}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          item={deleteTarget}
          mode={mode}
        />
      ) : null}

      {restoreTarget ? (
        <RestoreDialog
          open
          onOpenChange={(open) => {
            if (!open) setRestoreTarget(null);
          }}
          item={restoreTarget}
        />
      ) : null}

      {previewTarget ? (
        <PreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreviewTarget(null);
          }}
          item={previewTarget}
          onShare={(item) => {
            setPreviewTarget(null);
            setShareTarget(item);
          }}
          onRename={(item) => {
            setPreviewTarget(null);
            setRenameTarget(item);
          }}
        />
      ) : null}

      {versionTarget ? (
        <VersionHistoryDialog
          open
          onOpenChange={(open) => {
            if (!open) setVersionTarget(null);
          }}
          item={versionTarget}
          isPremium={isPremium}
        />
      ) : null}
    </div>
  );
}

interface SortMenuProps {
  readonly sortKey: SortKey;
  readonly sortDirection: SortDirection;
  readonly onChange: (key: SortKey, direction: SortDirection) => void;
}

function SortMenu({ sortKey, sortDirection, onChange }: SortMenuProps) {
  const options: {
    key: SortKey;
    label: string;
    icon: typeof ArrowDownAZ;
  }[] = [
    { key: "name", label: "Name", icon: ArrowDownAZ },
    { key: "size", label: "Size", icon: Ruler },
    { key: "updatedAt", label: "Last modified", icon: Clock },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <LayoutGrid className="size-4" />
          <span className="hidden sm:inline">Sort</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = sortKey === option.key;

          return (
            <DropdownMenuItem
              key={option.key}
              onSelect={() =>
                onChange(
                  option.key,
                  isActive && sortDirection === "asc" ? "desc" : "asc",
                )
              }
              className={cn(isActive && "bg-accent/60")}
            >
              <Icon className="size-4" />
              {option.label}
              {isActive ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  {sortDirection === "asc" ? "↑" : "↓"}
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange("name", "asc")}>
          <List className="size-4" />
          Reset sorting
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
