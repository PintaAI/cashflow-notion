# Building an MCP Server for Your App That Supports ChatGPT Connector

A practical guide to adding a Model Context Protocol (MCP) server to your Next.js app, deploying it on Vercel, and connecting it to ChatGPT as a custom connector.

---

## Table of Contents

1. [What is MCP?](#what-is-mcp)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Step 1: Install Dependencies](#step-1-install-dependencies)
5. [Step 2: Create MCP Tool Modules](#step-2-create-mcp-tool-modules)
6. [Step 3: Create the MCP Route](#step-3-create-the-mcp-route)
7. [Step 4: Deploy to Vercel](#step-4-deploy-to-vercel)
8. [Step 5: Connect to ChatGPT](#step-5-connect-to-chatgpt)
9. [Step 6: Connect to Other Clients](#step-6-connect-to-other-clients)
10. [Tool Design Best Practices](#tool-design-best-practices)
11. [Security Considerations](#security-considerations)
12. [Troubleshooting](#troubleshooting)

---

## What is MCP?

**Model Context Protocol (MCP)** is an open standard that lets AI agents (ChatGPT, Claude, Cursor, etc.) discover and invoke tools on your server. Instead of writing custom integrations for each AI platform, you expose your app's capabilities as MCP tools, and any MCP-compatible client can use them.

**What MCP enables:**
- AI agents can read data from your app (e.g., "show my expenses this month")
- AI agents can write data (e.g., "add a $50 lunch expense")
- AI agents can perform complex queries (e.g., "compare my spending in Q1 vs Q2")

**Why MCP over custom APIs:**
- One implementation works with ChatGPT, Claude, Cursor, VS Code, and any MCP client
- Tools are self-describing — the AI reads descriptions and decides when to use them
- Built-in input validation via JSON Schema (powered by Zod)

---

## Architecture Overview

```
AI Client (ChatGPT, Cursor, Claude)
        │
        │  Streamable HTTP (POST /api/mcp)
        ▼
┌─────────────────────────────┐
│   Next.js App on Vercel     │
│   /api/mcp/route.ts         │  ← MCP Server (mcp-handler)
│     ↳ tool_1                │
│     ↳ tool_2                │
│     ↳ tool_N                │
│                             │
│   Auth: Bearer token        │
│     or: ?api_key= query     │
└──────────────┬──────────────┘
               │
               ▼
     Your Database / APIs
```

**Key components:**
- **`mcp-handler`** — Vercel's adapter that turns Next.js route handlers into MCP servers
- **`@modelcontextprotocol/sdk`** — The official MCP TypeScript SDK
- **`zod`** — Schema validation for tool inputs

---

## Prerequisites

- Next.js 13+ with App Router
- Node.js 18+
- A Vercel project (or any HTTPS hosting)
- Existing data layer (database, API, etc.) that you want to expose

---

## Step 1: Install Dependencies

```bash
npm install mcp-handler@^1.1.0 @modelcontextprotocol/sdk@^1.29.0
```

> **Important:** Use `@modelcontextprotocol/sdk >= 1.26.0`. Earlier versions have a security vulnerability (CVE-2026-25536) that causes concurrent requests to leak data across sessions.

---

## Step 2: Create MCP Tool Modules

Organize tools by domain. Each tool module registers related tools on the MCP server.

### File Structure

```
lib/mcp/
├── tools/
│   ├── index.ts          # Aggregates all tool registrations
│   ├── utils.ts          # Shared helpers (ok, error, validation)
│   ├── entries.ts        # CRUD tools for your main entity
│   ├── analytics.ts      # Read-only analytics tools
│   └── categories.ts     # Category management tools
```

### Shared Utilities (`lib/mcp/tools/utils.ts`)

```typescript
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function ok(message: string, data?: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: data === undefined
          ? message
          : `${message}\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
    ...(data === undefined ? {} : { structuredContent: { data } }),
  };
}

export function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
```

### Example Tool Module (`lib/mcp/tools/entries.ts`)

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, toolError } from "@/lib/mcp/tools/utils";
import { getEntries, createEntry, updateEntry, deleteEntry } from "@/lib/db";

export function registerEntryTools(server: McpServer) {
  // Read tool — list entries with filters
  server.registerTool(
    "list_entries",
    {
      title: "List Entries",
      description: "List entries with optional filters and pagination.",
      inputSchema: {
        category: z.string().optional().describe("Filter by category name"),
        date: z.string().optional().describe("Filter by date (YYYY-MM-DD)"),
        pageSize: z.number().int().min(1).max(100).optional(),
        skip: z.number().int().min(0).optional(),
      },
    },
    async ({ category, date, pageSize = 20, skip = 0 }) => {
      try {
        const entries = await getEntries({ category, date, pageSize, skip });
        return ok(`Found ${entries.length} entries.`, { entries });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // Write tool — create an entry
  server.registerTool(
    "create_entry",
    {
      title: "Create Entry",
      description: "Create a new entry. Expenses require a category.",
      inputSchema: {
        name: z.string().min(1).describe("Entry name"),
        amount: z.number().positive().describe("Amount"),
        category: z.string().optional().describe("Category name"),
        date: z.string().optional().describe("Date (YYYY-MM-DD)"),
        type: z.enum(["Income", "Expense"]).describe("Income or Expense"),
      },
    },
    async ({ name, amount, category, date, type }) => {
      try {
        const entry = await createEntry({ name, amount, category, date, type });
        return ok("Created entry.", entry);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // Delete tool — always describe as destructive
  server.registerTool(
    "delete_entry",
    {
      title: "Delete Entry",
      description: "Permanently delete an entry by ID. This cannot be undone.",
      inputSchema: {
        id: z.string().min(1).describe("Entry ID"),
      },
    },
    async ({ id }) => {
      try {
        await deleteEntry(id);
        return ok("Deleted entry.", { id });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
```

### Aggregator (`lib/mcp/tools/index.ts`)

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEntryTools } from "@/lib/mcp/tools/entries";
import { registerAnalyticsTools } from "@/lib/mcp/tools/analytics";
import { registerCategoryTools } from "@/lib/mcp/tools/categories";

export function registerAllTools(server: McpServer) {
  registerEntryTools(server);
  registerAnalyticsTools(server);
  registerCategoryTools(server);
}
```

---

## Step 3: Create the MCP Route

### File: `app/api/mcp/route.ts`

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerAllTools } from "@/lib/mcp/tools";

// Force Node.js runtime (required for Prisma and most database clients)
export const runtime = "nodejs";
export const maxDuration = 60;

// 1. Create the MCP handler with all tools
const handler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  {
    serverInfo: {
      name: "my-app",
      version: "1.0.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

// 2. Auth function — supports both Bearer header AND query param
async function verifyToken(
  request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const expectedToken = process.env.MCP_API_KEY;

  // Option A: Bearer token from Authorization header
  if (expectedToken && bearerToken && bearerToken === expectedToken) {
    return {
      token: bearerToken,
      clientId: "mcp-client",
      scopes: ["read", "write"],
    };
  }

  // Option B: Query param (workaround for ChatGPT connector)
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("api_key");
  if (expectedToken && queryToken && queryToken === expectedToken) {
    return {
      token: queryToken,
      clientId: "mcp-client",
      scopes: ["read", "write"],
    };
  }

  return undefined;
}

// 3. Wrap with auth
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["read", "write"],
});

// 4. Export all HTTP methods
export { authHandler as GET, authHandler as POST, authHandler as DELETE };
```

### Why Both Auth Methods?

| Client | Auth Support |
|--------|-------------|
| ChatGPT | Query param only (no custom headers) |
| Cursor | Bearer header via `headers` config |
| Claude Desktop | Bearer header via environment |
| Claude Code | Bearer header via `.mcp.json` |

Supporting both methods ensures maximum client compatibility.

---

## Step 4: Deploy to Vercel

### Environment Variables

Set these in Vercel (Production, Preview, Development):

```bash
# Required
MCP_API_KEY=<generate-a-strong-random-string>
DATABASE_URL=<your-database-connection-string>

# Optional (depending on your app)
# ... your other app env vars
```

Generate a strong API key:

```bash
openssl rand -hex 32
# Output: mcp_a1b2c3d4e5f6...
```

### Vercel-Specific Settings

In your route file:

```typescript
export const runtime = "nodejs";    // NOT edge — required for Prisma
export const maxDuration = 60;      // Increase if tools are slow
```

Enable **Fluid Compute** in Vercel project settings for better handling of long-running MCP requests.

### Deploy

```bash
git add -A
git commit -m "feat: add MCP server"
git push origin main
```

Vercel will auto-deploy. Your MCP endpoint will be:

```
https://your-app.vercel.app/api/mcp
```

---

## Step 5: Connect to ChatGPT

### Why Query Param Auth for ChatGPT?

ChatGPT's custom connector **does not support static API keys or custom headers**. It only supports:
- OAuth 2.1 (complex setup)
- No Authentication (public endpoints)

The **query param workaround** lets you use "No Authentication" mode while keeping your endpoint secured:

### Setup Steps

1. Open ChatGPT → **Settings** → **Apps** → **Advanced** → Enable **Developer Mode**

2. Click **Create** new connector

3. Fill in:
   - **Name:** `My App`
   - **Description:** `Description of what your app does`
   - **Connection URL:**
     ```
     https://your-app.vercel.app/api/mcp?api_key=YOUR_MCP_API_KEY
     ```
   - **Authentication:** `None`

4. Click **Create**

5. ChatGPT will scan your tools. You should see all registered tools listed.

6. Accept the security warnings (write/delete tools will trigger these).

7. In a chat, enable your connector and try:
   ```
   Use My App to show me my summary
   ```

### ChatGPT Plan Requirements

| Plan | Read Tools | Write Tools |
|------|-----------|-------------|
| Plus / Pro | Yes | No |
| Business | Yes | Yes |
| Enterprise / Edu | Yes | Yes |

> Write-capable tools (create, update, delete) are silently disabled on Plus/Pro plans.

---

## Step 6: Connect to Other Clients

### Cursor

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "my-app": {
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "my-app": {
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

### Claude Code

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "my-app": {
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

---

## Tool Design Best Practices

### 1. Write Clear Descriptions

The AI reads tool descriptions to decide when to call them. Be specific:

```typescript
// Bad
description: "Get data"

// Good
description: "Get total income, expenses, and balance for a specific date range. Supports filtering by category."
```

### 2. Use `.describe()` on Every Input Field

```typescript
inputSchema: {
  startDate: z.string().describe("Start date in YYYY-MM-DD format"),
  category: z.string().describe("Category name (e.g., Food, Transport)"),
}
```

### 3. Validate Inputs Strictly

```typescript
inputSchema: {
  amount: z.number().positive().describe("Amount must be greater than 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format"),
  pageSize: z.number().int().min(1).max(100).optional(),
}
```

### 4. Return Structured Data

Always return both human-readable text AND structured data:

```typescript
return {
  content: [{ type: "text", text: `Found ${count} entries.` }],
  structuredContent: { entries, count, hasMore },
};
```

### 5. Handle Errors Gracefully

Never throw unhandled exceptions. Always catch and return `isError: true`:

```typescript
try {
  const result = await doSomething();
  return ok("Success.", result);
} catch (error) {
  return toolError(error); // { content: [...], isError: true }
}
```

### 6. Describe Destructive Operations

```typescript
description: "Permanently delete an entry by ID. This cannot be undone."
```

---

## Security Considerations

### API Key Security

- Generate keys with `openssl rand -hex 32`
- Store in environment variables, never in code
- Rotate keys periodically
- Use different keys per environment (dev/staging/prod)

### Query Param Warning

Passing API keys in URLs is **not ideal** for production:
- URLs may appear in server logs
- Browser history may store them
- Referrer headers could leak them

For production with ChatGPT, consider implementing **OAuth 2.1** instead. For personal/team use, the query param approach is acceptable.

### Scope-Based Access

For finer control, check scopes inside tool handlers:

```typescript
server.registerTool(
  "delete_entry",
  { /* ... */ },
  async ({ id }, extra) => {
    // Check if client has write scope
    const scopes = extra.authInfo?.scopes ?? [];
    if (!scopes.includes("write")) {
      return toolError(new Error("Insufficient permissions"));
    }
    // ... proceed with deletion
  },
);
```

### SDK Version Security

Always use `@modelcontextprotocol/sdk >= 1.26.0`:

| Version | Vulnerability |
|---------|--------------|
| < 1.26.0 | CVE-2026-25536 — concurrent session data leak |
| < 1.28.0 | CVE-2026-0621 — ReDoS in URI template parsing |
| >= 1.29.0 | All known CVEs patched |

---

## Troubleshooting

### "No actions available yet" in ChatGPT

**Cause:** ChatGPT failed to discover tools.

**Fix:**
1. Verify the URL is correct: `https://your-app.vercel.app/api/mcp?api_key=YOUR_KEY`
2. Test the endpoint manually (see below)
3. Delete the connector and recreate it
4. Check Vercel function logs for errors

### Test Endpoint Manually

```bash
# Initialize
curl -X POST "https://your-app.vercel.app/api/mcp?api_key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# List tools (after initialize)
curl -X POST "https://your-app.vercel.app/api/mcp?api_key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

### 401 Unauthorized

- Check that `MCP_API_KEY` is set in Vercel environment variables
- Verify the key in the URL matches exactly (no extra spaces)
- After changing env vars, redeploy the project

### Build Errors with `mcp-handler`

Ensure peer dependency compatibility:

```bash
# mcp-handler 1.1.0 expects @modelcontextprotocol/sdk 1.26.0
# But 1.29.0 also works (peer dep warning is non-blocking)
npm install mcp-handler@^1.1.0 @modelcontextprotocol/sdk@^1.29.0
```

### Prisma Not Working on Vercel

- Set `export const runtime = "nodejs"` (not edge)
- Ensure `DATABASE_URL` and `DIRECT_URL` are set in Vercel env
- Add `"postinstall": "prisma generate"` to `package.json` scripts

### Tools Not Showing in ChatGPT After Deploy

Vercel deployments take 1-2 minutes. Wait for the deployment to show `Ready` status, then delete and recreate the ChatGPT connector.

---

## Quick Reference

### Minimal MCP Server (Single File)

```typescript
// app/api/mcp/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "hello",
      {
        title: "Hello World",
        description: "Returns a greeting for the given name.",
        inputSchema: {
          name: z.string().describe("Name to greet"),
        },
      },
      async ({ name }) => ({
        content: [{ type: "text", text: `Hello, ${name}!` }],
      }),
    );
  },
  { serverInfo: { name: "my-app", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60 },
);

async function verifyToken(request: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const key = process.env.MCP_API_KEY;
  const url = new URL(request.url);
  const token = bearerToken || url.searchParams.get("api_key");
  if (!key || !token || token !== key) return undefined;
  return { token, clientId: "mcp-client", scopes: ["read", "write"] };
}

const authHandler = withMcpAuth(handler, verifyToken, { required: true });
export { authHandler as GET, authHandler as POST, authHandler as DELETE };
```

### Dependencies

```json
{
  "dependencies": {
    "mcp-handler": "^1.1.0",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.0.0"
  }
}
```

### Environment Variables

```bash
MCP_API_KEY=<openssl rand -hex 32>
DATABASE_URL=<your-database-url>
```

### ChatGPT Connector URL

```
https://your-app.vercel.app/api/mcp?api_key=YOUR_MCP_API_KEY
```

---

## Further Reading

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vercel MCP Handler](https://github.com/vercel/mcp-handler)
- [Deploy MCP Servers to Vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)
- [ChatGPT Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)
