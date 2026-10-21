import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DriveShell } from "@/components/dashboard/drive-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { listFolderContents } from "@/lib/db/queries/drive";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Drive",
};

interface DrivePageProps {
  readonly searchParams: Promise<{ q?: string }>;
}

export default async function DrivePage({ searchParams }: DrivePageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  const { q } = await searchParams;
  const { folders, files } = await listFolderContents(user.id, null);

  const query = q?.trim().toLowerCase() ?? "";
  const items = query
    ? [...folders, ...files].filter((item) =>
        item.name.toLowerCase().includes(query),
      )
    : [...folders, ...files];

  return (
    <DriveShell
      items={items}
      breadcrumbs={[]}
      currentFolderId={null}
      emptyTitle={query ? "No matching files" : "Your drive is empty"}
      emptyDescription={
        query
          ? "Try a different search term."
          : "Drag files here or upload them to get started."
      }
    />
  );
}
