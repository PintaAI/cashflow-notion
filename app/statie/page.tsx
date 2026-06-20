import type { Metadata } from "next";
import { StatieHome } from "@/components/statie/statie-home";

export const metadata: Metadata = {
  title: "Statie",
  description: "Social debate room game with AI-generated statements.",
};

export default function StatiePage() {
  return <StatieHome />;
}
