"use client";

import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { removeAvatarAction } from "@/lib/actions/account";
import {
  AVATAR_ACCEPT_ATTRIBUTE,
  isAllowedAvatarType,
  MAX_AVATAR_SIZE,
} from "@/lib/avatar";
import { initials } from "@/lib/utils";

interface ProfilePhotoCardProps {
  readonly name: string;
  readonly image: string | null;
}

/**
 * Profile photo.
 *
 * The image is uploaded directly to the authenticated avatar endpoint, which
 * verifies the real file signature before it is stored. Only raster formats
 * are accepted — an SVG could carry a script.
 */
export function ProfilePhotoCard({ name, image }: ProfilePhotoCardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, startRemoveTransition] = useTransition();

  async function handleFile(file: File) {
    if (!isAllowedAvatarType(file.type)) {
      toast.error("Only JPG, PNG, WebP, GIF and AVIF photos are supported.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("The photo is too large (4 MB maximum).");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "The photo could not be uploaded.");
      }

      toast.success("Profile photo updated");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    startRemoveTransition(async () => {
      const result = await removeAvatarAction();

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success("Profile photo removed");
      router.refresh();
    });
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="size-4 text-primary" />
          Profile photo
        </CardTitle>
        <CardDescription>
          Your photo is shown in the sidebar and next to your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-20 ring-2 ring-border">
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="text-lg">
              {initials(name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP, GIF or AVIF · up to 4 MB. The picture is stored
              privately and only visible to you.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept={AVATAR_ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleFile(file);
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {image ? "Replace photo" : "Upload photo"}
              </Button>

              {image ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRemoving}
                  onClick={handleRemove}
                >
                  {isRemoving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
