"use client";

import {
  Download,
  FolderInput,
  Pencil,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import type { DriveItem } from "@/types";

export type DriveMode = "drive" | "trash";

export interface ItemMenuProps {
  readonly item: DriveItem;
  readonly mode: DriveMode;
  readonly onRename: (item: DriveItem) => void;
  readonly onShare: (item: DriveItem) => void;
  readonly onMove: (item: DriveItem) => void;
  readonly onDelete: (item: DriveItem) => void;
  readonly onRestore: (item: DriveItem) => void;
}

export type ItemActions = Omit<ItemMenuProps, "item" | "mode">;

/**
 * The action set shared by the kebab menu (⋯) and the right-click context
 * menu, so both surfaces always offer exactly the same capabilities.
 */
export function ItemMenuItems({
  item,
  mode,
  onRename,
  onShare,
  onMove,
  onDelete,
  onRestore,
}: ItemMenuProps) {
  if (mode === "trash") {
    return (
      <>
        <DropdownMenuItem onSelect={() => onRestore(item)}>
          <RotateCcw className="size-4" />
          Restore
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => onDelete(item)}>
          <Trash2 className="size-4" />
          Delete permanently
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <>
      {item.type === "file" ? (
        <DropdownMenuItem asChild>
          <a href={`/api/files/${item.id}/download`} download>
            <Download className="size-4" />
            Download
          </a>
        </DropdownMenuItem>
      ) : null}

      {item.canModify ? (
        <>
          <DropdownMenuItem onSelect={() => onRename(item)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => onShare(item)}>
            <Share2 className="size-4" />
            Share
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => onMove(item)}>
            <FolderInput className="size-4" />
            Move to…
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem destructive onSelect={() => onDelete(item)}>
            <Trash2 className="size-4" />
            Move to trash
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  );
}

/** Context-menu flavoured version of {@link ItemMenuItems}. */
export function ContextMenuItems({
  item,
  mode,
  onRename,
  onShare,
  onMove,
  onDelete,
  onRestore,
}: ItemMenuProps) {
  if (mode === "trash") {
    return (
      <>
        <ContextMenuItem onSelect={() => onRestore(item)}>
          <RotateCcw className="size-4" />
          Restore
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem destructive onSelect={() => onDelete(item)}>
          <Trash2 className="size-4" />
          Delete permanently
        </ContextMenuItem>
      </>
    );
  }

  return (
    <>
      {item.type === "file" ? (
        <ContextMenuItem asChild>
          <a href={`/api/files/${item.id}/download`} download>
            <Download className="size-4" />
            Download
          </a>
        </ContextMenuItem>
      ) : null}

      {item.canModify ? (
        <>
          <ContextMenuItem onSelect={() => onRename(item)}>
            <Pencil className="size-4" />
            Rename
          </ContextMenuItem>

          <ContextMenuItem onSelect={() => onShare(item)}>
            <Share2 className="size-4" />
            Share
          </ContextMenuItem>

          <ContextMenuItem onSelect={() => onMove(item)}>
            <FolderInput className="size-4" />
            Move to…
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem destructive onSelect={() => onDelete(item)}>
            <Trash2 className="size-4" />
            Move to trash
          </ContextMenuItem>
        </>
      ) : null}
    </>
  );
}
