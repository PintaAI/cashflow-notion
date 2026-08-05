import type { Metadata } from "next";

import { EthosLanding } from "./ethos-landing";

export const metadata: Metadata = {
  title: "Cashflow dan LifeFlow dalam Genggaman",
  description:
    "Kelola shared wallet bersama pasangan, keluarga, dan teman melalui Cashflow. Tata habits, journal, dan scheduling personal melalui LifeFlow.",
  keywords: [
    "aplikasi cashflow",
    "shared wallet pasangan",
    "aplikasi keuangan keluarga",
    "habit tracker Indonesia",
    "journal app",
    "scheduling app",
  ],
  alternates: {
    canonical: "/",
    languages: { "id-ID": "/", "en-US": "/en", "x-default": "/en" },
  },
  openGraph: {
    title: "Ethos: Cashflow dan LifeFlow dalam Genggaman",
    description: "Shared wallet untuk orang terdekat dan personal life management dalam satu app.",
    url: "/",
    locale: "id_ID",
    alternateLocale: ["en_US"],
  },
  twitter: {
    title: "Ethos: Cashflow dan LifeFlow",
    description: "Kelola uang bersama dan tata kehidupan personal dalam satu app.",
  },
};

export default function IndonesianLandingPage() {
  return <EthosLanding locale="id" />;
}
