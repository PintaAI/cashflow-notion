import type { Metadata } from "next";

import { EthosLanding } from "../ethos-landing";

export const metadata: Metadata = {
  title: "Ethos | Cashflow and LifeFlow in your hands",
  description:
    "An easy-to-use Cashflow app with shared wallets, plus personal LifeFlow tools for habits, journaling, and scheduling.",
  alternates: {
    canonical: "/en",
    languages: { id: "/", en: "/en" },
  },
};

export default function EnglishLandingPage() {
  return <EthosLanding locale="en" />;
}
