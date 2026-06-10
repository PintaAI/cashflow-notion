"use client";

import { useEffect } from "react";

export const FONT_FAMILY_KEY = "cashflow.fontFamily";
export const FONT_SIZE_KEY = "cashflow.fontSize";
export const FONT_SPACING_KEY = "cashflow.fontSpacing";
export const FONT_CHANGED_EVENT = "cashflow-font-changed";

export const FONT_OPTIONS = [
  { value: "jetbrains-mono", label: "JetBrains Mono", family: "var(--font-mono)" },
  { value: "inter", label: "Inter", family: "var(--font-inter)" },
  { value: "roboto", label: "Roboto", family: "var(--font-roboto)" },
  { value: "poppins", label: "Poppins", family: "var(--font-poppins)" },
  { value: "lora", label: "Lora", family: "var(--font-lora)" },
] as const;

export const FONT_SIZE_OPTIONS = [
  { value: "14px", label: "Kecil" },
  { value: "16px", label: "Normal" },
  { value: "18px", label: "Besar" },
  { value: "20px", label: "Sangat Besar" },
] as const;

export const FONT_SPACING_OPTIONS = [
  { value: "-0.04em", label: "Rapat" },
  { value: "-0.02em", label: "Normal" },
  { value: "0em", label: "Longgar" },
  { value: "0.02em", label: "Sangat Longgar" },
] as const;

function applyFontPreferences() {
  const fontFamily = localStorage.getItem(FONT_FAMILY_KEY);
  const fontSize = localStorage.getItem(FONT_SIZE_KEY);
  const fontSpacing = localStorage.getItem(FONT_SPACING_KEY);

  const style = document.getElementById("user-font") ?? document.createElement("style");
  style.id = "user-font";

  const rules: string[] = [];

  if (fontFamily) {
    const opt = FONT_OPTIONS.find((f) => f.value === fontFamily);
    if (opt) {
      rules.push(`--font-body: ${opt.family}`);
    }
  }

  if (fontSize) {
    rules.push(`--font-size-root: ${fontSize}`);
  }

  if (fontSpacing) {
    rules.push(`--tracking-body: ${fontSpacing}`);
  }

  style.textContent = rules.length > 0 ? `:root { ${rules.join("; ")} }` : "";

  if (!style.parentNode) {
    document.head.appendChild(style);
  }
}

export function FontStyle() {
  useEffect(() => {
    applyFontPreferences();

    window.addEventListener("storage", applyFontPreferences);
    window.addEventListener(FONT_CHANGED_EVENT, applyFontPreferences);

    return () => {
      window.removeEventListener("storage", applyFontPreferences);
      window.removeEventListener(FONT_CHANGED_EVENT, applyFontPreferences);
    };
  }, []);

  return null;
}
