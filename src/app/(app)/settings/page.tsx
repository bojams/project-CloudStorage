import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsPanel } from "@/components/settings/settings-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { getStorageUsage } from "@/lib/db/queries/drive";
import { formatPercent } from "@/lib/utils";
import type { SessionUser, StorageUsage } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  const usage = await getStorageUsage(user.id);

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: null,
    role: user.role,
  };

  const storageUsage: StorageUsage = {
    used: usage.used,
    quota: usage.quota,
    percent: formatPercent(usage.used, usage.quota),
    fileCount: usage.fileCount,
  };

  return <SettingsPanel user={sessionUser} usage={storageUsage} />;
}
