"use client";

import { useState } from "react";

export function BetaRedeemForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || !confirmed) return;
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/v1/billing/redeem-beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setStatus("success");
        setMessage("Kode berhasil ditukarkan. Akses premium lifetime Anda sudah aktif.");
        return;
      }

      const messages: Record<string, string> = {
        BETA_REDEMPTION_DISABLED: "Penukaran kode beta sudah ditutup.",
        BETA_CODE_INVALID: "Kode tidak valid, kedaluwarsa, atau sudah digunakan.",
        BETA_CODE_EXPIRED: "Kode tidak valid, kedaluwarsa, atau sudah digunakan.",
        BETA_CODE_ALREADY_REDEEMED: "Kode tidak valid, kedaluwarsa, atau sudah digunakan.",
      };
      setStatus("error");
      setMessage(messages[body?.error] ?? "Gagal menukarkan kode.");
    } catch {
      setStatus("error");
      setMessage("Gagal terhubung ke server. Coba lagi.");
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold">Tukarkan Kode Beta</h1>
      <p className="mb-6 text-muted-foreground">
        Akses premium lifetime akan diberikan ke <strong>{email}</strong>.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Masukkan kode"
          autoComplete="off"
          className="w-full rounded-lg border px-4 py-3 font-mono text-lg tracking-wider"
          disabled={status === "loading" || status === "success"}
        />
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={status === "loading" || status === "success"}
            className="mt-1"
          />
          <span>Saya mengonfirmasi bahwa akun di atas adalah akun Ethos saya.</span>
        </label>
        <button
          type="submit"
          disabled={status === "loading" || status === "success" || !code.trim() || !confirmed}
          className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {status === "loading" ? "Memproses..." : "Tukarkan"}
        </button>
      </form>
      {message ? (
        <p className={`mt-4 rounded-lg p-3 text-sm ${status === "success" ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}>
          {message}
        </p>
      ) : null}
    </main>
  );
}
