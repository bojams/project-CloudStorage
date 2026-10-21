"use client";

import { Loader2, UserPlus } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { registerAction } from "@/lib/actions/account";
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

export function RegisterForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await registerAction(form);

      if (!result.ok) {
        setError(result.error.message);
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        }
        return;
      }

      toast.success("Account created. Signing you in…");

      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
        callbackUrl: "/drive",
      });

      if (!signInResult || signInResult.error) {
        router.push("/login");
        return;
      }

      router.push("/drive");
      router.refresh();
    });
  }

  return (
    <Card className="border-border/70 shadow-xl shadow-black/5 backdrop-blur">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Start organising your files in a private, secure workspace.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Ada Lovelace"
              aria-invalid={fieldErrors.name ? "true" : undefined}
            />
            {fieldErrors.name ? (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.name[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="you@example.com"
              aria-invalid={fieldErrors.email ? "true" : undefined}
            />
            {fieldErrors.email ? (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.email[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="At least 8 characters"
              aria-invalid={fieldErrors.password ? "true" : undefined}
            />
            {fieldErrors.password ? (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.password[0]}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Use at least 8 characters, including a letter and a number.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(event) =>
                updateField("confirmPassword", event.target.value)
              }
              placeholder="Repeat your password"
              aria-invalid={fieldErrors.confirmPassword ? "true" : undefined}
            />
            {fieldErrors.confirmPassword ? (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.confirmPassword[0]}
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="gradient"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
