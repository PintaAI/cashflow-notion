import type { Metadata } from "next";

import { EthosLanding } from "./ethos-landing";

export const metadata: Metadata = {
  title: "Ethos | Cashflow dan LifeFlow dalam genggaman",
  description:
    "Kelola Cashflow bersama pasangan, keluarga, dan teman, serta tata LifeFlow personal melalui habits, journal, dan scheduling.",
  alternates: {
    canonical: "/",
    languages: { id: "/", en: "/en" },
  },
};

export default function IndonesianLandingPage() {
  return <EthosLanding locale="id" />;
}
