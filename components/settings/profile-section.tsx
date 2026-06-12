"use client";
import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react"
import { Edit02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { getPalette } from "colorthief";
import { ImageCropDialog } from "@/components/profile";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProfileImageSrc } from "@/lib/profile-image";
import {
  updateProfile,
  type ProfileActionState,
} from "@/app/actions/profile";
import {
  generateThemeFromSwatches,
  type GeneratedThemeColors,
} from "@/lib/theme-palettes";

type EditableProfileUser = {
  name: string;
  email: string;
  image: string | null;
};

const initialProfileState: ProfileActionState = {
  status: "idle",
  message: "",
};

function ProfileEditor({ user, onUpdated }: { user: EditableProfileUser; onUpdated: (user: EditableProfileUser, generatedTheme: GeneratedThemeColors | null) => void }) {
  const [name, setName] = useState(user.name);
  const [state, setState] = useState<ProfileActionState>(initialProfileState);
  const [namePending, setNamePending] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const [themeMessage, setThemeMessage] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const themeExtractionRef = useRef<Promise<GeneratedThemeColors | null> | null>(null);

  async function extractThemeFromImageUrl(url: string) {
    const image = new window.Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    const palette = await getPalette(image, { colorCount: 6 });
    if (!palette) return null;
    return generateThemeFromSwatches(palette.map((c) => c.hex()));
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.currentTarget.value = "";
    setCropFile(file);
  }

  async function handleCropSave(croppedFile: File) {
    const previewUrl = URL.createObjectURL(croppedFile);
    setObjectPreviewUrl(previewUrl);
    setPhotoPending(true);
    setThemeMessage("Mengekstrak warna...");
    setState({ status: "idle", message: "" });

    let theme: GeneratedThemeColors | null = null;
    try {
      themeExtractionRef.current = extractThemeFromImageUrl(previewUrl);
      theme = await themeExtractionRef.current;
    } catch {
      theme = null;
    }

    const formData = new FormData();
    formData.set("name", name.trim() || user.name);
    formData.set("image", croppedFile);

    try {
      const result = await updateProfile(initialProfileState, formData);
      setState(result);
      if (result.status === "success" && result.user) {
        onUpdated(result.user as EditableProfileUser, theme);
        setThemeMessage(theme ? "Foto dan tema tersimpan." : "Foto tersimpan.");
      }
    } finally {
      setPhotoPending(false);
      setObjectPreviewUrl(null);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNamePending(true);
    setState({ status: "idle", message: "" });
    const formData = new FormData(e.currentTarget);
    try {
      const result = await updateProfile(initialProfileState, formData);
      setState(result);
      if (result.status === "success" && result.user) {
        onUpdated(result.user as EditableProfileUser, null);
      }
    } finally {
      setNamePending(false);
    }
  }

  const nameChanged = name.trim() !== user.name.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-2">
        <label className="group relative cursor-pointer" aria-label="Ganti foto profil">
          <Avatar className="size-22 text-3xl font-semibold" size="lg">
            {objectPreviewUrl ? (
              <AvatarImage src={objectPreviewUrl} alt="Preview" />
            ) : getProfileImageSrc(user.image) ? (
              <AvatarImage src={getProfileImageSrc(user.image)!} alt="Foto profil" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
            <AvatarBadge className="right-0 bottom-1 size-7 border bg-background text-foreground shadow-sm transition-colors group-hover:bg-muted">
            {photoPending ? (
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-3.5 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-3.5" />
            )}
            </AvatarBadge>
          </Avatar>
          <input type="file" name="image" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={photoPending} />
        </label>
        <p className="text-xs text-muted-foreground">
          {photoPending ? "Menyimpan foto..." : themeMessage || "Klik foto untuk mengganti"}
        </p>
      </div>

      <ImageCropDialog
        open={cropFile !== null}
        file={cropFile}
        onClose={() => setCropFile(null)}
        onSave={handleCropSave}
      />

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Nama</p>
        <div className="flex gap-2">
          <Input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            disabled={namePending || photoPending}
            className="flex-1"
          />
          <Button type="submit" disabled={namePending || photoPending || !nameChanged || name.trim().length < 2}>
            {namePending ? "..." : "Simpan"}
          </Button>
        </div>
      </div>

      {state.message && <p className="text-xs text-muted-foreground" aria-live="polite">{state.message}</p>}
    </form>
  );
}

export { ProfileEditor }
