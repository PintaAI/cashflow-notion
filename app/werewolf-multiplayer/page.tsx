import type { Metadata } from "next";
import { WerewolfHome } from "@/components/werewolf/werewolf-home";

export const metadata: Metadata = {
  title: "Werewolf Multiplayer",
  description: "Public multiplayer Werewolf room game.",
};

export const dynamic = "force-dynamic";

export default function WerewolfMultiplayerPage() {
  return <WerewolfHome />;
}
