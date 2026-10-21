"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { SidebarContent } from "@/components/dashboard/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SessionUser, StorageUsage } from "@/types";

interface MobileNavProps {
  readonly user: SessionUser;
  readonly usage: StorageUsage;
}

/**
 * Mobile navigation drawer. The very same sidebar content is reused on small
 * screens so the experience stays consistent across breakpoints.
 */
export function MobileNav({ user, usage }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[17rem] p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent user={user} usage={usage} pathname={pathname} inSheet />
      </SheetContent>
    </Sheet>
  );
}
