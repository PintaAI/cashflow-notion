"use client";

import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

type WerewolfRole = "Werewolf" | "Seer" | "Doctor" | "Jester" | "Villager";

interface RoleInfo {
  title: string;
  emoji: string;
  description: string;
  front: string;
  back: string;
  accent: string;
}

const ROLE_INFO: Record<WerewolfRole, RoleInfo> = {
  Werewolf: {
    title: "Werewolf",
    emoji: "🐺",
    description:
      "Setiap malam (mulai Malam 2), pilih satu pemain untuk dibunuh. Pada Malam 1, semua werewolf saling mengenali tanpa kill. Saat siang, sembunyikan identitasmu dan arahkan diskusi agar desa salah tuduh.",
    front: "bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent border-red-500/30",
    back: "bg-gradient-to-br from-red-500/20 via-red-500/10 to-transparent border-red-500/40",
    accent: "text-red-600 dark:text-red-400",
  },
  Seer: {
    title: "Seer",
    emoji: "🔮",
    description:
      "Setiap malam, periksa satu pemain untuk mengetahui rolenya. Gunakan info ini untuk membimbing desa saat siang, tapi jangan ketahuan agar werewolf tidak menargetkanmu.",
    front: "bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-500/30",
    back: "bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent border-indigo-500/40",
    accent: "text-indigo-600 dark:text-indigo-400",
  },
  Doctor: {
    title: "Doctor",
    emoji: "🩺",
    description:
      "Setiap malam, pilih satu pemain untuk dilindungi. Kalau werewolf menyerang pemain itu, serangan gagal dan tidak ada korban malam.",
    front: "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30",
    back: "bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/40",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  Jester: {
    title: "Jester",
    emoji: "🃏",
    description:
      "Kamu menang sendiri kalau desa memvoting kamu keluar. Berpura-puralah mencurigakan, tapi jangan sampai dibunuh werewolf duluan.",
    front: "bg-gradient-to-br from-fuchsia-500/15 via-fuchsia-500/5 to-transparent border-fuchsia-500/30",
    back: "bg-gradient-to-br from-fuchsia-500/20 via-fuchsia-500/10 to-transparent border-fuchsia-500/40",
    accent: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  Villager: {
    title: "Warga",
    emoji: "🧑‍🌾",
    description:
      "Kamu tidak punya aksi malam. Temukan werewolf lewat diskusi dan pola voting siang hari. Suaramu sama berharga dengan role lain — gunakan dengan tepat.",
    front: "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30",
    back: "bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/40",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
};

export interface WerewolfRoleCardProps {
  role: string | null;
  className?: string;
  children?: React.ReactNode;
}

export function WerewolfRoleCard({ role, className, children }: WerewolfRoleCardProps) {
  const [open, setOpen] = React.useState(false);
  const [flipped, setFlipped] = React.useState(false);
  const info = role ? ROLE_INFO[role as WerewolfRole] : null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setFlipped(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        {children ?? (
          <button
            type="button"
            className={cn(
              "group flex shrink-0 items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40 hover:shadow-sm",
              className,
            )}
          >
            <span className="text-xl leading-none" aria-hidden>{info?.emoji ?? "🃏"}</span>
            <span className="space-y-0.5">
              <span className="block text-[10px] font-medium text-muted-foreground">Role kamu</span>
              <span className={cn("block text-sm font-bold leading-tight", info ? info.accent : "text-primary")}>
                {info?.title ?? "—"}
              </span>
            </span>
          </button>
        )}
      </DrawerTrigger>

      <DrawerContent className="mx-auto max-h-[90vh] max-w-md data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <DrawerHeader className="text-center">
          <DrawerTitle>Kartu Role</DrawerTitle>
          <DrawerDescription>Ketuk kartu untuk membalik dan membaca penjelasan role.</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-8">
          {info ? (
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="block w-full cursor-pointer [perspective:1400px]"
              aria-label={flipped ? "Tutup penjelasan role" : "Buka penjelasan role"}
            >
              <div
                className={cn(
                  "relative h-80 w-full transition-transform duration-500 ease-out transform-3d",
                  flipped && "rotate-y-180",
                )}
              >
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 backface-hidden [transform:translateZ(1px)]",
                    info.front,
                  )}
                >
                  <span className="text-7xl drop-shadow-sm" aria-hidden>{info.emoji}</span>
                  <span className={cn("text-2xl font-bold tracking-tight", info.accent)}>{info.title}</span>
                  <span className="mt-1 rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    Ketuk untuk membalik
                  </span>
                </div>
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-6 backface-hidden [transform:rotateY(180deg)_translateZ(1px)]",
                    info.back,
                  )}
                >
                  <span className={cn("text-xs font-bold uppercase tracking-wider", info.accent)}>
                    {info.title}
                  </span>
                  <span className="text-center text-sm leading-relaxed text-foreground/90">
                    {info.description}
                  </span>
                  <span className="mt-1 rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    Ketuk untuk kembali
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              Role belum dibagikan. Tunggu game dimulai.
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
