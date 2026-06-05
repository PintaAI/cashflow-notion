"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const PLACEHOLDER_KEY = "YOUR_MCP_API_KEY";

export function McpConnectionGuide() {
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const apiKey = process.env.NEXT_PUBLIC_MCP_API_KEY || PLACEHOLDER_KEY;
  const chatGptUrl = `${baseUrl}/api/mcp?api_key=${apiKey}`;

  const mcpConfig = {
    mcpServers: {
      cashflow: {
        url: `${baseUrl}/api/mcp`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      <CopyField label="ChatGPT — isi sebagai Connection URL" value={chatGptUrl} />
      <CopyField
        label="AI Lainnya — copy ke .cursor/mcp.json atau .mcp.json"
        value={JSON.stringify(mcpConfig, null, 2)}
      />
    </div>
  );
}

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
