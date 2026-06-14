"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { LOCAL_THEME_CHANGED_EVENT, LOCAL_THEMES_KEY, SELECTED_LOCAL_THEME_KEY, getPreferredLocalTheme, type LocalTheme } from "@/components/layout";
import { cn } from "@/lib/utils"
import { parseThemeColors } from "@/lib/theme-palettes";

function getLocalThemes(): LocalTheme[] {
  try {
    const rawThemes = window.localStorage.getItem(LOCAL_THEMES_KEY);
    if (!rawThemes) return [];
    const parsed = JSON.parse(rawThemes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalTheme(theme: LocalTheme) {
  const nextThemes = [theme, ...getLocalThemes().filter((item) => item.id !== theme.id)].slice(0, 5);
  window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes));
  window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, theme.id);
  window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
}

function subscribeLocalThemes(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange);
  };
}

function getLocalThemesSnapshot() {
  return window.localStorage.getItem(LOCAL_THEMES_KEY) ?? "[]";
}

function getSelectedLocalThemeSnapshot() {
  return window.localStorage.getItem(SELECTED_LOCAL_THEME_KEY) ?? "";
}

function getEmptyLocalThemesSnapshot() {
  return "[]";
}

function getEmptySelectedLocalThemeSnapshot() {
  return "";
}

function parseLocalThemesSnapshot(snapshot: string): LocalTheme[] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ThemeSettings() {
  const themesSnapshot = useSyncExternalStore(subscribeLocalThemes, getLocalThemesSnapshot, getEmptyLocalThemesSnapshot);
  const selectedThemeSnapshot = useSyncExternalStore(subscribeLocalThemes, getSelectedLocalThemeSnapshot, getEmptySelectedLocalThemeSnapshot);
  const themes = parseLocalThemesSnapshot(themesSnapshot);
  const selectedThemeId = selectedThemeSnapshot || null;
  const activeThemeId = getPreferredLocalTheme(themes, selectedThemeId)?.id ?? null;
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleThemeChange(value: string) {
    const nextTheme = value === "default" ? getPreferredLocalTheme(themes, null) : getPreferredLocalTheme(themes, value);
    setMessage("");
    startTransition(() => {
      if (nextTheme) {
        window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, nextTheme.id);
      } else {
        window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY);
      }
      window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
      setMessage("Tema berhasil diterapkan di perangkat ini.");
    });
  }

  function handleDeleteTheme(themeId: string) {
    setMessage("");
    startTransition(() => {
      const nextThemes = getLocalThemes().filter((theme) => theme.id !== themeId);
      const nextTheme = getPreferredLocalTheme(nextThemes, selectedThemeId === themeId ? null : selectedThemeId);
      window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes));
      if (nextTheme) {
        window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, nextTheme.id);
      } else {
        window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY);
      }
      window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
      setMessage("Tema dihapus.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Hasil tema dari foto profil dan foto dompet. Maksimal 5 tema.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleThemeChange("default")}
          className={cn(
            "rounded-lg border p-3 text-left transition-colors hover:bg-accent/60",
            activeThemeId && "cursor-not-allowed opacity-60 hover:bg-transparent",
            !activeThemeId && "border-primary bg-primary/5"
          )}
          disabled={isPending || Boolean(activeThemeId)}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">Tema bawaan</p>
            {!activeThemeId && <span className="text-xs text-primary">Aktif</span>}
          </div>
          {activeThemeId ? <p className="mb-2 text-xs text-muted-foreground">Dipakai hanya jika tidak ada tema foto.</p> : null}
          <div className="flex overflow-hidden rounded-md border">
            <span className="h-8 flex-1 bg-[#ffffff]" />
            <span className="h-8 flex-1 bg-[#f4f4f5]" />
            <span className="h-8 flex-1 bg-[#18181b]" />
            <span className="h-8 flex-1 bg-[#e4e4e7]" />
          </div>
        </button>

        {themes.map((theme) => (
          <div
            key={theme.id}
            className={cn(
              "rounded-lg border p-3 transition-colors hover:bg-accent/60",
              activeThemeId === theme.id && "border-primary bg-primary/5"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleThemeChange(theme.id)}
                className="min-w-0 flex-1 text-left"
                disabled={isPending}
              >
                <p className="truncate text-sm font-medium">{theme.name}</p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {activeThemeId === theme.id && <span className="text-xs text-primary">Aktif</span>}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteTheme(theme.id)}
                  disabled={isPending}
                  title="Hapus tema"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className="flex w-full overflow-hidden rounded-md border"
              disabled={isPending}
            >
              {(parseThemeColors(theme.colors)?.swatches ?? []).map((swatch) => (
                <span key={swatch} className="h-8 flex-1" style={{ backgroundColor: swatch }} />
              ))}
            </button>
          </div>
        ))}
      </div>
      {themes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Belum ada tema tersimpan. Unggah foto profil untuk membuat tema dari palet warna foto.
        </p>
      ) : null}
      {message && <p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>}
    </div>
  );
}

export { ThemeSettings, getLocalThemes, saveLocalTheme }
