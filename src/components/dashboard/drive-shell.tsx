import { Suspense } from "react";

import { DriveSkeleton } from "@/components/dashboard/drive-skeleton";
import { DriveView } from "@/components/dashboard/drive-view";
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
 */
export function DriveShell(props: DriveShellProps) {
  return (
    <Suspense fallback={<DriveSkeleton />}>
      <DriveView {...props} />
    </Suspense>
  );
}
