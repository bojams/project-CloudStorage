import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DriveShell } from "@/components/dashboard/drive-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import {
  getFolderAccess,
  getFolderAncestors,
  listFolderContents,
  listSharedFolderContents,
} from "@/lib/db/queries/drive";
import { uuidSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Folder",
};

interface FolderPageProps {
  readonly params: Promise<{ folderId: string }>;
  readonly searchParams: Promise<{ q?: string }>;
}

export default async function FolderPage({
  params,
  searchParams,
}: FolderPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  const { folderId } = await params;

  // The folder id is a UUID — folder *names* never appear in the URL, which
  // removes path traversal and encoding tricks from the equation.
  const parsedId = uuidSchema.safeParse(folderId);
  if (!parsedId.success) notFound();

  const access = await getFolderAccess(user.id, parsedId.data);
  if (!access) notFound();

  const { q } = await searchParams;
  const query = q?.trim().toLowerCase() ?? "";

  const contents = access.isOwner
    ? await listFolderContents(user.id, parsedId.data)
    : await listSharedFolderContents(parsedId.data, {
        canModify: access.canEdit,
      });

  const breadcrumbs = await getFolderAncestors(access.ownerId, parsedId.data);

  const items = query
    ? [...contents.folders, ...contents.files].filter((item) =>
        item.name.toLowerCase().includes(query),
      )
    : [...contents.folders, ...contents.files];

  return (
    <DriveShell
      items={items}
      breadcrumbs={breadcrumbs}
      currentFolderId={parsedId.data}
      canUpload={access.isOwner}
      emptyTitle={query ? "No matching files" : "This folder is empty"}
      emptyDescription={
        query
          ? "Try a different search term."
          : "Drag files here or upload them to get started."
      }
    />
  );
}
