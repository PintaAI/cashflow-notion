import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Roboto, Poppins, Lora, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { PullToRefreshWrapper } from "@/components/pwa";
import { LocalThemeStyle, FontStyle } from "@/components/layout";
import { CSS_VARIABLE_NAMES } from "@/lib/theme-palettes";
import { fetchExchangeRates, fetchUserCurrency } from "@/app/actions/preferences";

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
    if (!selectedThemeId) return;

    const rawThemes = window.localStorage.getItem("cashflow.themes");
    if (!rawThemes) return;

    const themes = JSON.parse(rawThemes);
    if (!Array.isArray(themes)) return;

    const theme = themes.find((item) => item && item.id === selectedThemeId);
    const colors = theme && theme.colors;
    if (!colors || typeof colors !== "object" || Array.isArray(colors) || !colors.light || !colors.dark) return;

    const cssVariables = new Set(${JSON.stringify(CSS_VARIABLE_NAMES)});
    const serialize = (mode) => {
      if (!mode || typeof mode !== "object" || Array.isArray(mode)) return "";
      return Object.entries(mode)
        .filter(([key, value]) => cssVariables.has(key) && typeof value === "string" && /^[#(),.%\\w\\s-]+$/.test(value))
        .map(([key, value]) => "--" + key + ": " + value + ";")
        .join("\\n");
    };

    const light = serialize(colors.light);
    const dark = serialize(colors.dark);
    if (!light && !dark) return;

    const style = document.getElementById("user-theme") || document.createElement("style");
    style.id = "user-theme";
    style.textContent = ":root {\\n" + light + "\\n}\\n.dark {\\n" + dark + "\\n}";
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
  title: "Cashflow Tracker",
  description: "Track your income and expenses",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cashflow Tracker",
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
              <PullToRefreshWrapper>
                {children}
              </PullToRefreshWrapper>
            </CurrencyProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
