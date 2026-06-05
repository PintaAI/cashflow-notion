"use client";

import { useEffect } from "react";
import { parseThemeColors, themeToCss } from "@/lib/theme-palettes";

export const LOCAL_THEMES_KEY = "cashflow.themes";
export const SELECTED_LOCAL_THEME_KEY = "cashflow.selectedThemeId";
export const LOCAL_THEME_CHANGED_EVENT = "cashflow-theme-changed";

export type LocalTheme = {
  id: string;
  name: string;
  colors: unknown;
  createdAt: string;
};

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

function applySelectedTheme() {
  const selectedThemeId = window.localStorage.getItem(SELECTED_LOCAL_THEME_KEY);
  const style = document.getElementById("user-theme") ?? document.createElement("style");
  style.id = "user-theme";

  if (!selectedThemeId) {
    style.textContent = "";
    return;
  }

  const theme = getLocalThemes().find((item) => item.id === selectedThemeId);
  const colors = parseThemeColors(theme?.colors);
  style.textContent = colors ? themeToCss(colors) : "";

  if (!style.parentNode) {
    document.head.appendChild(style);
  }
}

export function LocalThemeStyle() {
  useEffect(() => {
    applySelectedTheme();

    window.addEventListener("storage", applySelectedTheme);
    window.addEventListener(LOCAL_THEME_CHANGED_EVENT, applySelectedTheme);

    return () => {
      window.removeEventListener("storage", applySelectedTheme);
      window.removeEventListener(LOCAL_THEME_CHANGED_EVENT, applySelectedTheme);
    };
  }, []);

  return null;
}
