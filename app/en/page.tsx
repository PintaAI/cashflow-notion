import type { Metadata } from "next";

import { EthosLanding } from "../ethos-landing";

export const metadata: Metadata = {
  title: "Cashflow and LifeFlow in Your Hands",
  description:
    "An easy-to-use Cashflow app with shared wallets for partners, families, and friends, plus LifeFlow for habits, journaling, and scheduling.",
  keywords: [
    "easy cashflow app",
    "shared wallet app",
    "couples finance app",
    "family budget app",
    "personal life management",
    "habit journal schedule app",
  ],
  alternates: {
    canonical: "/en",
    languages: { "id-ID": "/", "en-US": "/en", "x-default": "/en" },
  },
  openGraph: {
    title: "Ethos: Cashflow and LifeFlow in Your Hands",
    description: "Shared money for the people closest to you and personal life management in one app.",
    url: "/en",
    locale: "en_US",
    alternateLocale: ["id_ID"],
  },
  twitter: {
    title: "Ethos: Cashflow and LifeFlow",
    description: "Manage money together and organize your personal life in one app.",
  },
};

export default function EnglishLandingPage() {
  return <EthosLanding locale="en" />;
}
