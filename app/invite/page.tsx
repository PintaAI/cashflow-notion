"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/app/actions/management";

export default function InvitePage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [status, setStatus] = useState<"ready" | "accepting" | "done" | "error">("ready");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      const redirect = code ? `/invite?code=${encodeURIComponent(code)}` : "/invite";
      router.push(`/auth?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
  }, [session, sessionLoading, code, router]);

  async function handleAccept() {
    if (!code) return;
    setStatus("accepting");
    try {
      const result = await acceptInvite(code);
      if (result.success === false) {
        setStatus("error");
        setMessage(result.message);
        return;
      }
      setStatus("done");
      setMessage("Berhasil bergabung! Anda sekarang memiliki akses ke management ini.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Gagal menerima undangan.");
    }
  }

  if (sessionLoading || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4">
      <div className="w-full space-y-6 text-center">
        {status === "ready" && (
          code ? <>
            <h1 className="text-2xl font-bold tracking-tight">
              Undangan Bergabung
            </h1>
            <p className="text-sm text-muted-foreground">
              Anda diundang untuk bergabung ke management bersama.
              Management pribadi Anda tetap tersimpan dan bisa diakses kapan saja.
            </p>
            <Button className="w-full" onClick={handleAccept}>
              Terima Undangan
            </Button>
          </> : <>
            <p className="text-destructive">Kode undangan tidak valid.</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Kembali
            </Button>
          </>
        )}
        {status === "accepting" && (
          <p className="text-muted-foreground">Memproses...</p>
        )}
        {status === "done" && (
          <>
            <p className="text-green-600">{message}</p>
            <Button className="w-full" onClick={() => router.push("/")}>
              Ke Halaman Utama
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-destructive">{message}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Kembali
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
