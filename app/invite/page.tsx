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
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push(`/auth?redirect=/invite?code=${code}`);
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("Kode undangan tidak valid.");
      return;
    }
    setStatus("ready");
  }, [session, sessionLoading, code, router]);

  async function handleAccept() {
    if (!code) return;
    setStatus("accepting");
    try {
      await acceptInvite(code);
      setStatus("done");
      setMessage("Berhasil bergabung! Data Anda telah digabungkan.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Gagal menerima undangan.");
    }
  }

  if (sessionLoading || status === "loading") {
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
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              Undangan Bergabung
            </h1>
            <p className="text-sm text-muted-foreground">
              Anda diundang untuk bergabung ke management bersama.
              Data management pribadi Anda akan digabungkan.
            </p>
            <Button className="w-full" onClick={handleAccept}>
              Terima Undangan
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
