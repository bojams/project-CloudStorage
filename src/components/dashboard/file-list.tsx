"use client";

import { MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";

import { FileIcon } from "@/components/dashboard/file-icon";
import {
  ContextMenuItems,
  ItemMenuItems,
  type DriveMode,
  type ItemActions,
} from "@/components/dashboard/item-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatBytes, formatRelativeDate } from "@/lib/utils";
import type { DriveItem } from "@/types";

interface FileListProps {
  readonly items: DriveItem[];
  readonly mode: DriveMode;
  readonly actions: ItemActions;
  readonly onOpen?: (item: DriveItem) => void;
}

/**
 * Compact, table-like representation of the drive contents.
 *
 * The rows fade in with a CSS animation (staggered through `animation-delay`)
 * so that a folder with many files does not need a JavaScript animation
 * runtime on the main thread.
 */
export function FileList({ items, mode, actions, onOpen }: FileListProps) {
  return (
    <div className="animate-rise-in overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-xs">
      <div className="hidden items-center gap-3 border-b border-border/70 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:flex">
        <span className="flex-1">Name</span>
        <span className="w-32 text-right">Size</span>
        <span className="w-36 text-right">Modified</span>
        <span className="w-9" />
      </div>

      <ul className="divide-y divide-border/60">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="animate-fade-in"
            style={{ animationDelay: `${Math.min(index * 0.012, 0.18)}s` }}
          >
            <ItemRow
              item={item}
              mode={mode}
              actions={actions}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ItemRowProps {
  readonly item: DriveItem;
  readonly mode: DriveMode;
  readonly actions: ItemActions;
  readonly onOpen?: (item: DriveItem) => void;
}

function ItemRow({ item, mode, actions, onOpen }: ItemRowProps) {
  const isFolder = item.type === "folder";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen?.(item)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen?.(item);
            }
          }}
          className={cn(
            "group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors",
            "hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
          )}
        >
          <FileIcon
            mimeType={item.mimeType}
            isFolder={isFolder}
            className="size-8 rounded-lg"
            iconClassName="size-4"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isFolder ? (
                <Link
                  href={`/drive/${item.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="truncate text-sm font-medium text-foreground hover:underline focus-visible:outline-none"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="truncate text-sm font-medium text-foreground">
                  {item.name}
                </span>
              )}

              {item.isShared ? (
                <Share2 className="size-3.5 shrink-0 text-muted-foreground/70" />
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground md:hidden">
              {isFolder ? "Folder" : formatBytes(item.size)} ·{" "}
              {formatRelativeDate(item.updatedAt)}
            </p>
          </div>

          <span className="hidden w-32 text-right text-xs tabular-nums text-muted-foreground md:block">
            {isFolder ? "—" : formatBytes(item.size)}
          </span>
          <span className="hidden w-36 text-right text-xs text-muted-foreground md:block">
            {formatRelativeDate(item.updatedAt)}
          </span>

          <div className="flex w-9 justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for ${item.name}`}
                  onClick={(event) => event.stopPropagation()}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ItemMenuItems item={item} mode={mode} {...actions} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItems item={item} mode={mode} {...actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
