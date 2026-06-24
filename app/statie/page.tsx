import type { Metadata } from "next";
import { StatieHome } from "@/components/statie/statie-home";
import { getStatiePopularTopics, getStatieStatements } from "@/app/actions/statie";
import { isCurrentUserAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Statie",
  description: "Social debate room game with AI-generated statements.",
};

export const dynamic = "force-dynamic";

export default async function StatiePage() {
  const [statements, popularTopics, isAdmin] = await Promise.all([
    getStatieStatements(),
    getStatiePopularTopics(),
    isCurrentUserAdmin(),
  ]);
  return <StatieHome statements={statements} popularTopics={popularTopics} isAdmin={isAdmin} />;
}
