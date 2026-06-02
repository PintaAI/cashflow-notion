import Image from "next/image";

import { getProfileImageSrc } from "@/lib/profile-image";
import { cn } from "@/lib/utils";

type AvatarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function getUserDisplayName(user: AvatarUser | null | undefined) {
  if (!user) return "Unknown";
  return user.name || user.email?.split("@")[0] || "Unknown";
}

export function UserAvatar({
  user,
  size = 24,
  className,
  fallbackClassName,
}: {
  user: AvatarUser | null | undefined;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}) {
  const imageSrc = getProfileImageSrc(user?.image);
  const displayName = getUserDisplayName(user);
  const initial = displayName[0]?.toUpperCase() ?? "?";

  if (imageSrc) {
    return (
      <Image
        src={imageSrc}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        unoptimized
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
        fallbackClassName,
      )}
    >
      {initial}
    </div>
  );
}
