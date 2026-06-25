import type { Metadata } from "next";
import { StatieHome } from "@/components/statie/statie-home";
import { getStatieLeaderboard, getStatiePopularTopics, getStatieStatements } from "@/app/actions/statie";
import { isCurrentUserAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Statie",
  description: "Social debate room game with AI-generated statements.",
};

export const dynamic = "force-dynamic";

export default async function StatiePage() {
  const [statements, popularTopics, leaderboard, isAdmin] = await Promise.all([
    getStatieStatements(),
    getStatiePopularTopics(),
    getStatieLeaderboard(),
    isCurrentUserAdmin(),
  ]);
  return <StatieHome statements={statements} popularTopics={popularTopics} leaderboard={leaderboard} isAdmin={isAdmin} />;
}
