"use client";

import { Loader2, LogOut, Save, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/lib/actions/account";
import { formatBytes } from "@/lib/utils";
import type { SessionUser, StorageUsage } from "@/types";

interface SettingsPanelProps {
  readonly user: SessionUser;
  readonly usage: StorageUsage;
}

export function SettingsPanel({ user, usage }: SettingsPanelProps) {
  const [name, setName] = useState(user.name);
  const [isSavingProfile, startProfileTransition] = useTransition();

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, startPasswordTransition] = useTransition();

  function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startProfileTransition(async () => {
      const result = await updateProfileAction({ name });

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success("Profile updated");
    });
  }

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    startPasswordTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      if (!result.ok) {
        setPasswordError(result.error.message);
        return;
      }

      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed");
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, security and storage preferences.
        </p>
      </header>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>
            This is how your name appears across the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Display name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input id="settings-email" value={user.email} disabled readOnly />
              <p className="text-[11px] text-muted-foreground">
                The email address is used to sign in and cannot be changed here.
              </p>
            </div>

            <Button type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>
            Choose a strong password you do not use anywhere else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={passwords.currentPassword}
                onChange={(event) =>
                  setPasswords((state) => ({
                    ...state,
                    currentPassword: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={passwords.newPassword}
                  onChange={(event) =>
                    setPasswords((state) => ({
                      ...state,
                      newPassword: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(event) =>
                    setPasswords((state) => ({
                      ...state,
                      confirmPassword: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {passwordError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive"
              >
                {passwordError}
              </p>
            ) : null}

            <Button type="submit" variant="outline" disabled={isSavingPassword}>
              {isSavingPassword ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Storage &amp; appearance</CardTitle>
          <CardDescription>
            {formatBytes(usage.used)} of {formatBytes(usage.quota)} used across{" "}
            {usage.fileCount} file{usage.fileCount === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Colour theme</p>
              <p className="text-xs text-muted-foreground">
                Light, dark or follow the system setting.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Session</p>
              <p className="text-xs text-muted-foreground">
                Sign out of this device.
              </p>
            </div>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
