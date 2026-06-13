import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buildEntryWhere,
  createEntry,
  deleteEntry,
  prisma,
  updateEntry,
  type IOType,
} from "@/lib/db";
import { isValidDate, ok, toolError, getManagementId, getUserId } from "@/lib/mcp/tools/utils";

const entryFields = {
  name: z.string().trim().min(1).describe("Entry name"),
  nominal: z.number().positive().describe("Amount of money"),
  category: z.string().trim().min(1).optional().describe("Category name"),
  date: z.string().optional().describe("Entry date in YYYY-MM-DD format"),
  io: z.enum(["Income", "Expenses"]).describe("Whether this entry is Income or Expenses"),
};

function toEntry(entry: Awaited<ReturnType<typeof prisma.entry.findFirst>> & { category?: { name: string } | null }) {
  if (!entry) return null;
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
    category: entry.category?.name ?? null,
    date: entry.date,
    io: entry.io,
  };
}

export function registerEntryTools(server: McpServer) {
  server.registerTool(
    "list_entries",
    {
      title: "List Cashflow Entries",
      description: "List income and expense entries with optional filters and pagination.",
      inputSchema: {
        io: z.enum(["Income", "Expenses"]).optional(),
        category: z.string().trim().min(1).optional(),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        pageSize: z.number().int().min(1).max(100).optional(),
        skip: z.number().int().min(0).optional(),
      },
    },
    async ({ io, category, date, pageSize = 20, skip = 0 }) => {
      try {
        if (date && !isValidDate(date)) throw new Error("Date must be a valid YYYY-MM-DD value");

        const mid = getManagementId();
        const entries = await prisma.entry.findMany({
          where: { managementId: mid, ...buildEntryWhere({ io: io as IOType | undefined, category, date }) },
          include: { category: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          skip,
          take: pageSize + 1,
        });
        const items = entries.slice(0, pageSize).map((entry) => ({
          id: entry.id,
          name: entry.name,
          nominal: entry.nominal,
          category: entry.category?.name ?? null,
          date: entry.date,
          io: entry.io,
        }));

        return ok(`Found ${items.length} cashflow entr${items.length === 1 ? "y" : "ies"}.`, {
          entries: items,
          hasMore: entries.length > pageSize,
          nextSkip: entries.length > pageSize ? skip + pageSize : null,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "get_entry",
    {
      title: "Get Cashflow Entry",
      description: "Get one cashflow entry by ID.",
      inputSchema: { id: z.string().min(1).describe("Entry ID") },
    },
    async ({ id }) => {
      try {
        const entry = await prisma.entry.findFirst({
          where: { id, managementId: getManagementId() },
          include: { category: true },
        });
        if (!entry) throw new Error(`Entry with ID "${id}" not found`);
        return ok("Found cashflow entry.", toEntry(entry));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_entry",
    {
      title: "Create Cashflow Entry",
      description: "Create a new income or expense entry.",
      inputSchema: entryFields,
    },
    async ({ name, nominal, category, date, io }) => {
      try {
        if (date && !isValidDate(date)) throw new Error("Date must be a valid YYYY-MM-DD value");

        const entry = await createEntry({ name, nominal, category, date, io, managementId: getManagementId(), userId: getUserId() });
        console.log(`MCP: create_entry succeeded id=${entry.id} name="${entry.name}"`);
        return ok("Created cashflow entry.", entry);
      } catch (error) {
        console.error("MCP: create_entry failed", error instanceof Error ? error.message : error);
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "update_entry",
    {
      title: "Update Cashflow Entry",
      description: "Update an existing income or expense entry by ID.",
      inputSchema: {
        id: z.string().min(1).describe("Entry ID"),
        name: z.string().trim().min(1).optional(),
        nominal: z.number().positive().optional(),
        category: z.string().trim().min(1).optional(),
        date: z.string().optional().describe("Entry date in YYYY-MM-DD format"),
        io: z.enum(["Income", "Expenses"]).optional(),
      },
    },
    async ({ id, name, nominal, category, date, io }) => {
      try {
        if (date && !isValidDate(date)) throw new Error("Date must be a valid YYYY-MM-DD value");
        const entry = await updateEntry(id, { name, nominal, category, date, io, managementId: getManagementId() });
        return ok("Updated cashflow entry.", entry);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "delete_entry",
    {
      title: "Delete Cashflow Entry",
      description: "Permanently delete a cashflow entry by ID. This cannot be undone.",
      inputSchema: { id: z.string().min(1).describe("Entry ID") },
    },
    async ({ id }) => {
      try {
        await deleteEntry(id, getManagementId());
        return ok("Deleted cashflow entry.", { id });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
