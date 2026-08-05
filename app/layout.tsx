import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Roboto, Poppins, Lora, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";

import { LocalThemeStyle, FontStyle } from "@/components/layout";
import { CSS_VARIABLE_NAMES } from "@/lib/theme-palettes";
import { fetchExchangeRates, fetchUserCurrency } from "@/app/actions/preferences";
import { APP_STORE_ID, APP_STORE_URL, SITE_URL } from "@/lib/site";

const FONT_FAMILY_MAP: Record<string, string> = {
  "jetbrains-mono": "var(--font-mono)",
  "inter": "var(--font-inter)",
  "roboto": "var(--font-roboto)",
  "poppins": "var(--font-poppins)",
  "lora": "var(--font-lora)",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const roboto = Roboto({ subsets: ["latin"], variable: "--font-roboto", weight: ["400", "500", "700"] });
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", weight: ["400", "500", "600", "700"] });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", weight: ["400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const localThemeScript = `(() => {
  try {
    const selectedThemeId = window.localStorage.getItem("cashflow.selectedThemeId");
    const rawThemes = window.localStorage.getItem("cashflow.themes");
    if (!rawThemes) return;

    const themes = JSON.parse(rawThemes);
    if (!Array.isArray(themes)) return;

    const cssVariables = new Set(${JSON.stringify(CSS_VARIABLE_NAMES)});
    const serialize = (mode) => {
      if (!mode || typeof mode !== "object" || Array.isArray(mode)) return "";
      return Object.entries(mode)
        .filter(([key, value]) => cssVariables.has(key) && typeof value === "string" && /^[#(),.%\\w\\s-]+$/.test(value))
        .map(([key, value]) => "--" + key + ": " + value + ";")
        .join("\\n");
    };

    const getThemeCss = (theme) => {
      const colors = theme && theme.colors;
      if (!colors || typeof colors !== "object" || Array.isArray(colors) || !colors.light || !colors.dark) return null;

      const lightMode = colors.swatches && Array.isArray(colors.swatches) ? {
        ...colors.light,
        sidebar: colors.light.background || colors.light.sidebar,
        "sidebar-foreground": colors.light.foreground || colors.light["sidebar-foreground"],
        "sidebar-accent": colors.light.muted || colors.light["sidebar-accent"],
        "sidebar-accent-foreground": colors.light.foreground || colors.light["sidebar-accent-foreground"],
        "sidebar-border": colors.light.border || colors.light["sidebar-border"],
        "sidebar-ring": colors.light.ring || colors.light["sidebar-ring"],
      } : colors.light;
      const light = serialize(lightMode);
      const dark = serialize(colors.dark);
      if (!light && !dark) return null;

      return ":root {\\n" + light + "\\n}\\n.dark {\\n" + dark + "\\n}";
    };

    const selectedTheme = selectedThemeId ? themes.find((item) => item && item.id === selectedThemeId) : null;
    let theme = selectedTheme && getThemeCss(selectedTheme) ? selectedTheme : null;
    if (!theme) theme = themes.find((item) => item && getThemeCss(item));
    const themeCss = getThemeCss(theme);
    if (!themeCss) {
      if (selectedThemeId) window.localStorage.removeItem("cashflow.selectedThemeId");
      return;
    }

    if (theme.id !== selectedThemeId) window.localStorage.setItem("cashflow.selectedThemeId", theme.id);

    const style = document.getElementById("user-theme") || document.createElement("style");
    style.id = "user-theme";
    style.textContent = themeCss;
    if (!style.parentNode) document.head.appendChild(style);
  } catch {}
})();`;

const fontPreferenceScript = `(() => {
  try {
    const rules = [];

    const fontFamily = window.localStorage.getItem("cashflow.fontFamily");
    if (fontFamily) {
      const map = ${JSON.stringify(FONT_FAMILY_MAP)};
      if (map[fontFamily]) {
        rules.push("--font-body: " + map[fontFamily]);
      }
    }

    const fontSize = window.localStorage.getItem("cashflow.fontSize");
    if (fontSize && /^\\d+px$/.test(fontSize)) {
      rules.push("--font-size-root: " + fontSize);
    }

    const fontSpacing = window.localStorage.getItem("cashflow.fontSpacing");
    if (fontSpacing && /^-?\\d+\\.?\\d*em$/.test(fontSpacing)) {
      rules.push("--tracking-body: " + fontSpacing);
    }

    if (rules.length === 0) return;

    const style = document.getElementById("user-font") || document.createElement("style");
    style.id = "user-font";
    style.textContent = ":root { " + rules.join("; ") + " }";
    if (!style.parentNode) document.head.appendChild(style);
  } catch {}
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ethos: Cashflow and LifeFlow in Your Hands",
    template: "%s | Ethos",
  },
  description: "Manage shared money with Cashflow and organize habits, journals, and schedules with LifeFlow.",
  applicationName: "ethos: Life OS",
  authors: [{ name: "Rores Sagella", url: SITE_URL }],
  creator: "Rores Sagella",
  publisher: "Rores Sagella",
  category: "Productivity",
  keywords: [
    "Ethos Life OS",
    "Cashflow app",
    "LifeFlow app",
    "shared wallet",
    "personal finance",
    "budget tracker",
    "habit tracker",
    "journal app",
    "schedule planner",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/landing/ethos-icon.png",
    apple: "/landing/ethos-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "ethos: Life OS",
    title: "Ethos: Cashflow and LifeFlow in Your Hands",
    description: "Manage shared money and organize your personal life in one easy-to-use app.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "ethos: Life OS",
    description: "Cashflow and LifeFlow, organized within your hands.",
  },
  appLinks: {
    ios: {
      url: APP_STORE_URL,
      app_store_id: APP_STORE_ID,
      app_name: "ethos: Life OS",
    },
    web: { url: SITE_URL, should_fallback: true },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "apple-itunes-app": `app-id=${APP_STORE_ID}, app-argument=${APP_STORE_URL}`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ethos",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(0.9838 0.0035 247.8583)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.1573 0.0228 265.6559)" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialCurrency, initialRates] = await Promise.all([
    fetchUserCurrency(),
    fetchExchangeRates(),
  ]).catch(() => ["IDR", { IDR: 1 }] as const);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, inter.variable, roboto.variable, poppins.variable, lora.variable, jetbrainsMono.variable)}
    >
      <head>
        <Script
          id="cashflow-local-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: localThemeScript }}
        />
        <Script
          id="cashflow-local-font"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: fontPreferenceScript }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LocalThemeStyle />
        <FontStyle />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <CurrencyProvider initialCurrency={initialCurrency} initialRates={initialRates}>
              {children}
            </CurrencyProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
