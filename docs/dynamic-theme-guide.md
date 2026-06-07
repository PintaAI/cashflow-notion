# Dynamic Theming Architecture

This document explains how the Cashflow Tracker app implements dynamic theming at the core level — a pattern you can reuse in any Next.js + Tailwind CSS + shadcn/ui project.

## Architecture Overview

Three independent layers stack to produce the final theme:

| Layer | What | How |
|-------|------|-----|
| **1. Base theme** | Default light/dark variables in CSS | `globals.css` — `:root` and `.dark` blocks using oklch |
| **2. Mode toggle** | Light ↔ Dark ↔ System | `next-themes` toggles `class="dark"` on `<html>`, persisted to `localStorage` |
| **3. User-generated local themes** | Per-device custom color palettes | Injected `<style id="user-theme">` overrides CSS variables at runtime, persisted to `localStorage` |

The key insight: **all three layers share the same CSS variable names** (`--background`, `--primary`, etc.). Components never need to know which layer is active.

---

## Layer 1: Base Theme (`globals.css`)

Define CSS custom properties in `:root` (light) and `.dark` (dark):

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.9838 0.0035 247.8583);
  --foreground: oklch(0.2064 0.0388 265.5472);
  --primary: oklch(0.6118 0.1301 239.2913);
  /* ... all 44+ variables */
}

.dark {
  --background: oklch(0.1573 0.0228 265.6559);
  --primary: oklch(0.7012 0.1445 238.5963);
  /* ... dark variants */
}
```

Map variables to Tailwind v4 theme tokens:

```css
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... all color tokens */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
}
```

Base layer applies classes that consume these tokens:

```css
@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

**shadcn/ui requirement:** `components.json` must have `"cssVariables": true` — this makes shadcn components reference CSS variables via Tailwind (e.g. `bg-background`, `text-primary`).

---

## Layer 2: Mode Toggle (`next-themes`)

### Setup

Wrap the app in a thin wrapper component:

```tsx
// components/providers/theme-provider.tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

Use it in the root layout:

```tsx
<ThemeProvider
  attribute="class"           // toggles "dark" class on <html>
  defaultTheme="system"       // respects OS preference on first visit
  enableSystem                // listens to prefers-color-scheme
  disableTransitionOnChange   // prevents flash during switch
>
  {children}
</ThemeProvider>
```

### Toggle button

```tsx
"use client";
import { useTheme } from "next-themes";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
```

Package dependency: `next-themes` ^0.4.6

---

## Layer 3: User-Generated Local Themes

This is the novel part. Users can upload a profile photo, extract its color palette, and generate a full set of CSS variables that override the base theme.

### 3a. Theme generation from image

Use `colorthief` to extract dominant colors, then derive 44 CSS variable values from 3 HSL hues.

```ts
// lib/theme-palettes.ts

export type GeneratedThemeColors = {
  light: Record<string, string>;  // --variable: value pairs
  dark: Record<string, string>;
  swatches: string[];             // hex colors from original palette
};

// CSS variable names that must exist in the theme
export const CSS_VARIABLE_NAMES = [
  "background", "foreground", "card", "card-foreground",
  "popover", "popover-foreground", "primary", "primary-foreground",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary",
  "sidebar-primary-foreground", "sidebar-accent", "sidebar-accent-foreground",
  "sidebar-border", "sidebar-ring",
] as const;

function generateThemeFromSwatches(hexSwatches: string[]): GeneratedThemeColors | null {
  // 1. Parse to HSL, filter near-black/white
  // 2. Pick primary (index 0), secondary (index 1), accent (index 2)
  // 3. Generate light and dark variable maps via buildVariables()
  // buildVariables() computes every variable from just 3 HSL colors:
  //   light.background  = hsl(primary.h, 14%, 97%)
  //   dark.background   = hsl(primary.h, 22%, 3.5%)
  //   light.primary     = hsl(primary.h, primary.s, 48%)
  //   dark.primary      = hsl(primary.h, primary.s, 46%)
  //   ... 40 more derived values
}

export function themeToCss(colors: GeneratedThemeColors): string {
  const serialize = (mode: Record<string, string>) =>
    Object.entries(mode).map(([k, v]) => `--${k}: ${v};`).join("\n");
  return `:root {\n${serialize(colors.light)}\n}\n.dark {\n${serialize(colors.dark)}\n}`;
}
```

### 3b. Flash-free injection (critical)

To prevent FOUC, the theme must be applied **before React hydrates**. Use `next/script` with `strategy="beforeInteractive"`:

```tsx
// app/layout.tsx
const localThemeScript = `(() => {
  try {
    const selectedThemeId = localStorage.getItem("cashflow.selectedThemeId");
    if (!selectedThemeId) return;
    const themes = JSON.parse(localStorage.getItem("cashflow.themes"));
    const theme = themes?.find(t => t.id === selectedThemeId);
    if (!theme?.colors?.light || !theme?.colors?.dark) return;

    const css = Object.entries(theme.colors.light)
      .map(([k, v]) => "--" + k + ": " + v + ";").join("\\n");
    const darkCss = Object.entries(theme.colors.dark)
      .map(([k, v]) => "--" + k + ": " + v + ";").join("\\n");

    const style = document.getElementById("user-theme") || document.createElement("style");
    style.id = "user-theme";
    style.textContent = ":root {\\n" + css + "\\n}\\n.dark {\\n" + darkCss + "\\n}";
    if (!style.parentNode) document.head.appendChild(style);
  } catch {}
})();`;
```

```tsx
<html>
  <head>
    <Script id="cashflow-local-theme" strategy="beforeInteractive">
      {localThemeScript}
    </Script>
  </head>
  ...
</html>
```

This injects a `<style id="user-theme">` into `<head>` with the user's CSS variables, overriding the base `:root`/`.dark` blocks at the same specificity. Since the CSS engine sees it immediately, the page renders with the correct colors on the very first paint.

### 3c. Runtime synchronization

A client component keeps the theme in sync when the user changes or deletes themes:

```tsx
// components/layout/local-theme-style.tsx
"use client";

const LOCAL_THEMES_KEY = "cashflow.themes";
const SELECTED_LOCAL_THEME_KEY = "cashflow.selectedThemeId";
const LOCAL_THEME_CHANGED_EVENT = "cashflow-theme-changed";

function applySelectedTheme() {
  const selectedThemeId = localStorage.getItem(SELECTED_LOCAL_THEME_KEY);
  const style = document.getElementById("user-theme") ?? document.createElement("style");
  style.id = "user-theme";

  if (!selectedThemeId) { style.textContent = ""; return; }

  const theme = getLocalThemes().find(t => t.id === selectedThemeId);
  const colors = parseThemeColors(theme?.colors);
  style.textContent = colors ? themeToCss(colors) : "";
  if (!style.parentNode) document.head.appendChild(style);
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
```

Render it in the root layout after the `<body>` tag:

```tsx
<body>
  <LocalThemeStyle />
  <ThemeProvider>...</ThemeProvider>
</body>
```

### 3d. Persistence

Everything lives in `localStorage`:

| Key | Value |
|-----|-------|
| `"cashflow.themes"` | `JSON.stringify(LocalTheme[])` — up to 5 themes |
| `"cashflow.selectedThemeId"` | `string` — UUID of active theme (absent/null = use default) |

Themes can optionally persist to the database (`User.profileTheme` JSON field) and sync down to other devices.

### 3e. Saving a new theme

```ts
function saveLocalTheme(theme: LocalTheme) {
  const next = [theme, ...getLocalThemes().filter(t => t.id !== theme.id)].slice(0, 5);
  localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(next));
  localStorage.setItem(SELECTED_LOCAL_THEME_KEY, theme.id);
  window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT)); // triggers re-apply
}
```

### 3f. Selecting/resetting

```ts
// Select a user theme
localStorage.setItem(SELECTED_LOCAL_THEME_KEY, themeId);
window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));

// Reset to default (remove override)
localStorage.removeItem(SELECTED_LOCAL_THEME_KEY);
window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
```

---

## How It All Fits Together

```
User uploads profile photo
       │
       ▼
  colorthief extracts 6 dominant hex colors
       │
       ▼
  generateThemeFromSwatches(swatches)
    → assigns primary/secondary/accent hues
    → buildVariables() computes { light, dark, swatches }
       │
       ├── saved to localStorage (cashflow.themes)
       ├── (optionally) saved to DB via server action
       └── applied as <style id="user-theme"> via custom event
              │
              ▼
         CSS variables override base theme
              │
              ▼
         All shadcn/ui + Tailwind classes
         (bg-background, text-foreground, etc.)
         react automatically — zero component changes
```

## Key Files

| File | Role |
|------|------|
| `app/globals.css` | Base CSS variables (`:root` + `.dark`), Tailwind `@theme` mappings, `@layer base` |
| `components/providers/theme-provider.tsx` | `next-themes` wrapper |
| `components/layout/local-theme-style.tsx` | Runtime theme injection + event listeners |
| `components/layout/theme-toggle.tsx` | Light/dark toggle button |
| `lib/theme-palettes.ts` | Color math: palette extraction, HSL derivation, CSS serialization |
| `app/layout.tsx` | Inline `<script>` for flash-free injection, `<ThemeProvider>` wrapping |
| `components/settings/theme-section.tsx` | UI for selecting/deleting saved themes |
| `components/settings/profile-section.tsx` | Profile photo upload → `colorthief` extraction pipeline |

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next-themes` | ^0.4.6 | Light/dark/system toggle, `<html>` class management |
| `colorthief` | ^3.3.1 | Extract color palette from user images |
| `tailwindcss` | ^4 | Utility framework with `@theme` + `@custom-variant` |
| `tw-animate-css` | ^1.4.0 | Animation utilities |

## Adapting to Another App

1. Copy `globals.css` — define `:root`, `.dark`, and `@theme inline` with the same variable names.
2. Install `next-themes`, wrap `<ThemeProvider attribute="class">` in your root layout.
3. Copy `lib/theme-palettes.ts` for color math.
4. Copy `components/layout/local-theme-style.tsx` for runtime injection.
5. In root layout, add the `beforeInteractive` `<Script>` from `app/layout.tsx`.
6. Add the theme toggle and your own UI for selecting/generating themes.
7. Set `"cssVariables": true` in `components.json` if using shadcn/ui.

The pattern generalizes beyond Next.js to any framework — the only hard requirement is the ability to inject a `<style>` block into `<head>` before the first paint.
