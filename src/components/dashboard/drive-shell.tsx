import { Suspense } from "react";

import { DriveSkeleton } from "@/components/dashboard/drive-skeleton";
import { DriveView } from "@/components/dashboard/drive-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserPlan } from "@/lib/db/queries/account";
import type { Breadcrumb, DriveItem } from "@/types";

interface DriveShellProps {
  readonly items: DriveItem[];
  readonly breadcrumbs: Breadcrumb[];
  readonly currentFolderId: string | null;
  readonly mode?: "drive" | "trash";
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly canUpload?: boolean;
}

/**
 * Wraps the drive view in a Suspense boundary.
 *
 * The drive view reads the search parameters (to pick up the
 * `?action=new-folder` handshake coming from the sidebar), which requires a
 * suspense boundary during server rendering.
 *
 * The shell also resolves the plan of the account, because the limits of the
 * plan (file size, premium features) have to be known by the client and are
 * never trusted from the browser alone.
 */
export async function DriveShell(props: DriveShellProps) {
  const user = await getCurrentUser();
  const { effective, isPremium } = await getUserPlan(user?.id ?? "");

  return (
    <Suspense fallback={<DriveSkeleton />}>
      <DriveView
        {...props}
        isPremium={isPremium}
        maxFileSizeBytes={effective.maxFileSizeBytes}
      />
    </Suspense>
  );
}
