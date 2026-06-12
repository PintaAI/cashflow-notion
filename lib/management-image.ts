export function getManagementImageSrc(image: string | null | undefined) {
  if (!image) return null;
  if (image.startsWith("managements/")) {
    return `/api/management-photo?pathname=${encodeURIComponent(image)}`;
  }

  return image;
}
