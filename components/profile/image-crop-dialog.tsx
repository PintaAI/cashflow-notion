"use client";

import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import imageCompression from "browser-image-compression";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";

type ImageCropDialogProps = {
  open: boolean;
  file: File | null;
  maxSizeKB?: number;
  onClose: () => void;
  onSave: (file: File) => void;
};

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area, fileType: string): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), fileType, 1);
  });
}

export function ImageCropDialog({
  open,
  file,
  maxSizeKB = 200,
  onClose,
  onSave,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      return () => URL.revokeObjectURL(url);
    }
    if (!open) {
      setImageSrc(null);
      setCroppedAreaPixels(null);
    }
  }, [open, file]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels || !file) return;
    setSaving(true);
    try {
      const croppedBlob = await getCroppedBlob(imageSrc, croppedAreaPixels, file.type);
      let croppedFile = new File([croppedBlob], file.name, {
        type: file.type,
        lastModified: Date.now(),
      });

      if (croppedFile.size > maxSizeKB * 1024) {
        croppedFile = await imageCompression(croppedFile, {
          maxSizeMB: maxSizeKB / 1024,
          useWebWorker: true,
          maxIteration: 10,
          fileType: file.type,
        });
      }

      onSave(croppedFile);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Foto Profil</DialogTitle>
          <DialogDescription>Posisikan dan perbesar foto, lalu simpan.</DialogDescription>
        </DialogHeader>
        {imageSrc && (
          <div className="relative mx-auto w-full overflow-hidden rounded-lg" style={{ height: 320 }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        )}
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground">Perbesar</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-xs"
          />
          <span className="min-w-[2.5ch] text-xs text-muted-foreground tabular-nums">{zoom.toFixed(1)}x</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? (
              <>
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-3.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
