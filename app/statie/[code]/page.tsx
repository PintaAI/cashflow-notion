import type { Metadata } from "next";
import { StatieRoom } from "@/components/statie/statie-room";

export const metadata: Metadata = {
  title: "Statie Room",
  description: "Join a Statie social debate room.",
};

export default async function StatieRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <StatieRoom code={code} />;
}
