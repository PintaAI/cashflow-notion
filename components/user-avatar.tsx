import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  return (
    <Avatar className={className} style={{ width: size, height: size }}>
      {imageSrc ? <AvatarImage src={imageSrc} alt="" /> : null}
      <AvatarFallback className={cn(fallbackClassName)}>{initial}</AvatarFallback>
    </Avatar>
  );
}
