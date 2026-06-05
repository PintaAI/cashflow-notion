"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listOAuthConnections, revokeOAuthConnection } from "@/app/actions/oauth";
import type { UserOAuthConnection } from "@/lib/oauth/server";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="relative">
        <pre className="bg-muted p-3 pr-20 rounded-lg text-xs font-mono whitespace-pre-wrap break-all">
          {value}
        </pre>
        <Button
          variant="outline"
          size="xs"
          className="absolute top-2 right-2"
          onClick={handleCopy}
        >
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
    </div>
  );
}

function McpKeySettings() {
  const [connections, setConnections] = useState<UserOAuthConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    listOAuthConnections().then((conns) => {
      setConnections(conns);
      setLoadingConnections(false);
    });
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
        <p className="text-xs font-semibold text-primary">Cara menghubungkan</p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Buka <strong>ChatGPT</strong> → Settings → Apps &amp; Connectors → nyalakan <strong>Developer Mode</strong></li>
          <li>Buat <strong>App</strong> baru, beri nama (contoh: &quot;Cashflow&quot;)</li>
          <li>Tempel <strong>MCP Server URL</strong> di bawah, pilih auth <strong>OAuth</strong></li>
          <li>Login seperti biasa — Anda akan diarahkan ke halaman login Cashflow</li>
          <li>Kembali ke chat, panggil lewat ikon <strong>+</strong> atau ketik <strong>@Cashflow</strong></li>
        </ol>
        <p className="text-[10px] text-muted-foreground border-t border-primary/10 pt-2 mt-1">
          Untuk <strong>Cursor</strong>: Settings → Features → MCP → paste URL yang sama.<br />
          Untuk <strong>AI lain</strong> (Claude Desktop, VS Code, Cline, dll): tempel URL yang sama dan pilih OAuth — caranya kurang lebih sama.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-xs font-medium">Salin URL ini</p>
        <CopyField label="MCP Server URL" value={`${baseUrl}/api/mcp`} />
        <p className="text-xs text-muted-foreground">
          Tempel URL ini ke AI client pilihan Anda, lalu pilih &quot;OAuth&quot; sebagai metode login.
        </p>

        {loadingConnections ? (
          <p className="text-xs text-muted-foreground">Memuat koneksi...</p>
        ) : connections.length > 0 ? (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium">Terhubung sebagai</p>
            {connections.map((c) => (
              <div key={c.clientId} className="flex items-center justify-between rounded-md border p-2.5">
                <p className="text-sm font-medium truncate">{c.clientName}</p>
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-2 shrink-0 text-red-500 border-red-200 hover:bg-red-50"
                  disabled={revoking === c.clientId}
                  onClick={async () => {
                    setRevoking(c.clientId);
                    try {
                      await revokeOAuthConnection(c.clientId);
                      setConnections((prev) => prev.filter((x) => x.clientId !== c.clientId));
                    } finally {
                      setRevoking(null);
                    }
                  }}
                >
                  {revoking === c.clientId ? "..." : "Putuskan"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { McpKeySettings }
