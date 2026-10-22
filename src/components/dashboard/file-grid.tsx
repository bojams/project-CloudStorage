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

interface FileGridProps {
  readonly items: DriveItem[];
  readonly mode: DriveMode;
  readonly actions: ItemActions;
  readonly onOpen?: (item: DriveItem) => void;
}

/**
 * Grid (gallery) representation of the drive contents.
 *
 * The entrance animation is handled by CSS instead of a JavaScript animation
 * library: with a large folder the difference is immediately noticeable,
 * because the browser can animate the items without the main thread running a
 * layout engine for every single tile.
 */
export function FileGrid({ items, mode, actions, onOpen }: FileGridProps) {
  return (
    <div className="animate-rise-in grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="animate-pop-in h-full"
          style={{ animationDelay: `${Math.min(index * 0.015, 0.2)}s` }}
        >
          <ItemTile item={item} mode={mode} actions={actions} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

interface ItemTileProps {
  readonly item: DriveItem;
  readonly mode: DriveMode;
  readonly actions: ItemActions;
  readonly onOpen?: (item: DriveItem) => void;
}

function ItemTile({ item, mode, actions, onOpen }: ItemTileProps) {
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
            "group relative flex h-full cursor-pointer flex-col rounded-2xl border border-border/80 bg-card/70 p-3.5 shadow-xs",
            "transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-lg hover:shadow-black/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <FileIcon mimeType={item.mimeType} isFolder={isFolder} />

            <div className="flex items-center gap-0.5">
              {item.isShared ? (
                <span
                  title="Shared"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground/70"
                >
                  <Share2 className="size-3.5" />
                </span>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Actions for ${item.name}`}
                    onClick={(event) => event.stopPropagation()}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
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

          {isFolder ? (
            <Link
              href={`/drive/${item.id}`}
              onClick={(event) => event.stopPropagation()}
              className="line-clamp-2 break-all text-sm font-medium leading-snug text-foreground hover:underline focus-visible:outline-none"
              title={item.name}
            >
              {item.name}
            </Link>
          ) : (
            <p
              className="line-clamp-2 break-all text-sm font-medium leading-snug text-foreground"
              title={item.name}
            >
              {item.name}
            </p>
          )}

          <p className="mt-1 text-xs text-muted-foreground">
            {isFolder ? "Folder" : formatBytes(item.size)} ·{" "}
            {formatRelativeDate(item.updatedAt)}
          </p>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItems item={item} mode={mode} {...actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
