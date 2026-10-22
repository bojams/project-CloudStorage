"use client";

import {
  Clock,
  Cloud,
  Crown,
  FolderPlus,
  HardDrive,
  LogOut,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StorageIndicator } from "@/components/dashboard/storage-indicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";
import type { SessionUser, StorageUsage } from "@/types";

interface AppSidebarProps {
  readonly user: SessionUser;
  readonly usage: StorageUsage;
}

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: typeof HardDrive;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/drive", label: "My Drive", icon: HardDrive },
  { href: "/shared", label: "Shared", icon: Share2 },
  { href: "/recent", label: "Recent", icon: Clock },
  { href: "/trash", label: "Trash", icon: Trash2 },
];

export function AppSidebar({ user, usage }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[16.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <SidebarContent
        user={user}
        usage={usage}
        pathname={pathname}
      />
    </aside>
  );
}

interface SidebarContentProps {
  readonly user: SessionUser;
  readonly usage: StorageUsage;
  readonly pathname: string;
  readonly inSheet?: boolean;
}

export function SidebarContent({
  user,
  usage,
  pathname,
  inSheet = false,
}: SidebarContentProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  /**
   * The sidebar is rendered outside of the page tree, so it cannot call the
   * page dialogs directly. Instead it navigates to the drive with an action
   * flag that the drive view picks up — a URL driven, framework agnostic
   * handshake that also keeps the action shareable.
   */
  const currentFolderId = pathname.startsWith("/drive/")
    ? (pathname.split("/")[2] ?? null)
    : null;

  function navigateWithAction(action: "new-folder" | "upload") {
    const base = currentFolderId ? `/drive/${currentFolderId}` : "/drive";
    router.push(`${base}?action=${action}`);
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className={cn("flex items-center gap-2.5 px-2", inSheet ? "pb-3 pt-1" : "py-2")}>
        <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/25">
          <Cloud className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            Nimbus Drive
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Secure cloud storage
          </p>
        </div>
      </div>

      <div className="px-0.5 pb-1">
        <Button
          type="button"
          variant="gradient"
          className="w-full justify-start gap-2"
          onClick={() => setIsCreateOpen((open) => !open)}
          aria-expanded={isCreateOpen}
        >
          <FolderPlus className="size-4" />
          New
        </Button>

        {isCreateOpen ? (
          <div className="animate-expand overflow-hidden">
            <div className="mt-1.5 space-y-0.5 rounded-xl border border-border bg-background/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  navigateWithAction("new-folder");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <FolderPlus className="size-4 text-muted-foreground" />
                New folder
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  navigateWithAction("upload");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <Upload className="size-4 text-muted-foreground" />
                Upload files
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {isActive ? (
                <span className="animate-fade-in absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              ) : null}
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 px-0.5 pb-1">
        <StorageIndicator
          used={usage.used}
          quota={usage.quota}
          fileCount={usage.fileCount}
        />
      </div>

      <UserMenu user={user} />
    </div>
  );
}

interface UserMenuProps {
  readonly user: SessionUser;
}

function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            {user.image ? (
              <AvatarImage src={user.image} alt="" />
            ) : null}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {user.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>My account</DropdownMenuLabel>
        {user.isPremium ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Crown className="size-4 text-primary" />
                Premium plan
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Sparkles className="size-4 text-primary" />
                Upgrade to Premium
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={() => {
            void signOut({ callbackUrl: "/login" });
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
