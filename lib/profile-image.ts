export function getProfileImageSrc(image: string | null | undefined) {
  if (!image) return null;
  if (image.startsWith("profiles/")) {
    return `/api/profile-photo?pathname=${encodeURIComponent(image)}`;
  }

  return image;
}
