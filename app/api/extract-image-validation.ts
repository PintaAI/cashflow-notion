import { NextResponse } from "next/server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageUpload(image: File | null) {
  if (!image) {
    return NextResponse.json(
      { success: false, error: "No image provided" },
      { status: 400 },
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json(
      { success: false, error: "Image must be a JPG, PNG, or WebP file" },
      { status: 400 },
    );
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { success: false, error: "Image size must be 5 MB or less" },
      { status: 413 },
    );
  }

  return null;
}
