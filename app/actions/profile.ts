"use server";

import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getBlobOptions } from "@/lib/blob";
import { getSession } from "@/lib/management";
import { parseThemeColors, type GeneratedThemeColors } from "@/lib/theme-palettes";

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
  user?: {
    name: string;
    email: string;
    image: string | null;
  };
};

export async function fetchProfileTheme(): Promise<GeneratedThemeColors | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { profileTheme: true },
  });

  return parseThemeColors(user?.profileTheme);
}

export async function saveProfileTheme(theme: unknown): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const colors = parseThemeColors(theme);
  if (!colors) throw new Error("Invalid profile theme");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { profileTheme: colors },
  });
}

export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Anda harus login terlebih dahulu." };
  }

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (name.length < 2) {
    return { status: "error", message: "Nama minimal 2 karakter." };
  }

  if (name.length > 80) {
    return { status: "error", message: "Nama maksimal 80 karakter." };
  }

  const file = formData.get("image");
  let imageUrl: string | undefined;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
      return { status: "error", message: "Foto harus berupa JPG, PNG, WebP, atau GIF." };
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      return { status: "error", message: "Ukuran foto maksimal 5 MB." };
    }

    try {
      const blobOptions = getBlobOptions();
      if (!blobOptions) {
        return { status: "error", message: "Upload foto gagal. Vercel Blob belum dikonfigurasi." };
      }

      const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const blob = await put(`profiles/${session.user.id}/${crypto.randomUUID()}.${extension}`, file, {
        ...blobOptions,
        access: "private",
        contentType: file.type,
      });

      imageUrl = blob.pathname;
    } catch {
      return { status: "error", message: "Upload foto gagal. Pastikan Vercel Blob sudah dikonfigurasi." };
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      ...(imageUrl ? { image: imageUrl } : {}),
    },
    select: { name: true, email: true, image: true },
  });

  return {
    status: "success",
    message: imageUrl ? "Profil berhasil diperbarui. Tema dari foto disimpan di perangkat ini." : "Profil berhasil diperbarui.",
    user,
  };
}
