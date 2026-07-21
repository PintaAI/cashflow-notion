import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BetaRedeemForm } from "./redeem-form";

export default async function BetaRedeemPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth?redirect=/beta/redeem");

  const deadline = process.env.BETA_REDEMPTION_DEADLINE;
  const enabled = process.env.BETA_REDEMPTION_ENABLED === "true";
  const expired = deadline ? new Date() > new Date(deadline) : false;

  if (!enabled || expired) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold">Penukaran kode beta ditutup</h1>
        <p className="mt-2 text-muted-foreground">Hubungi dukungan Ethos jika Anda memerlukan bantuan.</p>
      </main>
    );
  }

  return <BetaRedeemForm email={session.user.email} />;
}
