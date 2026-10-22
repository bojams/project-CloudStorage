"use client";

import { Check, Crown, Loader2, Lock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { changePlanAction } from "@/lib/actions/account";
import { PLANS, type PlanId } from "@/lib/plans";
import { formatBytes } from "@/lib/utils";
import type { StorageUsage } from "@/types";

interface PlanCardProps {
  readonly plan: PlanId;
  readonly isPremium: boolean;
  readonly planExpiresAt: string | null;
  readonly usage: StorageUsage;
}

/**
 * Subscription card.
 *
 * The checkout is simulated — the application has no payment provider wired
 * up — so the button activates the premium tier immediately. Everything else
 * (quota, file size limit, trash retention, version history) is enforced by
 * the server, not by the UI.
 */
export function PlanCard({
  plan,
  isPremium,
  planExpiresAt,
  usage,
}: PlanCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activePlan = PLANS[isPremium ? "PREMIUM" : "FREE"];
  const hasExpired = plan === "PREMIUM" && !isPremium;

  function handleChange(target: PlanId) {
    startTransition(async () => {
      const result = await changePlanAction({ plan: target });

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success(
        target === "PREMIUM"
          ? "Welcome to Nimbus Premium"
          : "Your plan was changed to Free",
      );
      router.refresh();
    });
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="size-4 text-primary" />
          Plan &amp; storage
        </CardTitle>
        <CardDescription>
          {activePlan.tagline}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={isPremium ? "default" : "secondary"}>
              {isPremium ? (
                <Sparkles className="size-3" />
              ) : null}
              {activePlan.name}
            </Badge>
            {hasExpired ? (
              <span className="text-xs text-muted-foreground">
                Your subscription has expired — the free limits apply again.
              </span>
            ) : null}
            {isPremium && planExpiresAt ? (
              <span className="text-xs text-muted-foreground">
                Renews on{" "}
                {new Date(planExpiresAt).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            ) : null}
          </div>

          {isPremium ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleChange("FREE")}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Cancel premium
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => handleChange("PREMIUM")}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Upgrade to Premium
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Storage</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatBytes(usage.used)} of {formatBytes(usage.quota)}
            </span>
          </div>
          <Progress value={usage.percent} />
        </div>

        <Separator />

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {PLANS.PREMIUM.features.map((feature) => {
            const unlocked = isPremium || !feature.premium;

            return (
              <li
                key={feature.label}
                className="flex items-center gap-2 text-sm"
              >
                {unlocked ? (
                  <Check className="size-4 shrink-0 text-success" />
                ) : (
                  <Lock className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={
                    unlocked ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {feature.label}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Demo checkout: no payment is processed and no card is required. The
          premium tier is activated on this account immediately and the limits
          above are enforced by the server.
        </p>
      </CardContent>
    </Card>
  );
}
