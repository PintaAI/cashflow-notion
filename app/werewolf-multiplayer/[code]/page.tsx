import type { Metadata } from "next";
import { WerewolfRoom } from "@/components/werewolf/werewolf-room";

export const metadata: Metadata = {
  title: "Werewolf Room",
  description: "Join a Werewolf Multiplayer room.",
};

export default async function WerewolfRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <WerewolfRoom code={code} />;
}
