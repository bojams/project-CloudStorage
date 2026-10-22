import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsPanel } from "@/components/settings/settings-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { getAccountOverview } from "@/lib/db/queries/account";
import { formatPercent } from "@/lib/utils";
import type { SessionUser, StorageUsage } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  const overview = await getAccountOverview(user.id);
  if (!overview) redirect(ROUTES.login);

  const sessionUser: SessionUser = {
    id: overview.id,
    name: overview.name,
    email: overview.email,
    image: overview.avatarUrl,
    role: overview.role,
    plan: overview.plan,
    isPremium: overview.isPremium,
  };

  const storageUsage: StorageUsage = {
    used: overview.used,
    quota: overview.storageQuota,
    percent: formatPercent(overview.used, overview.storageQuota),
    fileCount: overview.fileCount,
  };

  return (
    <SettingsPanel
      user={sessionUser}
      usage={storageUsage}
      planExpiresAt={overview.planExpiresAt}
    />
  );
}
