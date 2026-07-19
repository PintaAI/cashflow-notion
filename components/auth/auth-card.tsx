"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getSafeRedirect(redirect: string | null) {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return "/";
  return redirect;
}

export function AuthCard() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirect(searchParams.get("redirect"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signIn") {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
        });
        if (err) {
          setError(err.message || err.statusText || "Gagal masuk");
          return;
        }
      } else {
        const { error: err } = await authClient.signUp.email({
          name,
          email,
          password,
        });
        if (err) {
          setError(err.message || err.statusText || "Gagal mendaftar");
          return;
        }
      }
      router.push(redirect);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialSignIn(provider: "google" | "apple") {
    await authClient.signIn.social({
      provider,
      callbackURL: redirect,
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4">
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signIn" ? "Masuk" : "Daftar"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signIn"
              ? "Masuk ke akun Cashflow Tracker"
              : "Buat akun Cashflow Tracker"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signUp" && (
            <Input
              placeholder="Nama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Memproses..."
              : mode === "signIn"
                ? "Masuk"
                : "Daftar"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Atau
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSocialSignIn("google")}
          >
            Lanjutkan dengan Google
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSocialSignIn("apple")}
          >
            Lanjutkan dengan Apple
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "signIn" ? (
            <>
              Belum punya akun?{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setMode("signUp")}
              >
                Daftar
              </button>
            </>
          ) : (
            <>
              Sudah punya akun?{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setMode("signIn")}
              >
                Masuk
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
