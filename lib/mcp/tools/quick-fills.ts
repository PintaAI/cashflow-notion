import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createQuickFill, deleteQuickFill, getQuickFills } from "@/lib/db";
import { ok, toolError, getManagementId } from "@/lib/mcp/tools/utils";

export function registerQuickFillTools(server: McpServer) {
  server.registerTool(
    "list_quick_fills",
    {
      title: "List Quick Fills",
      description: "List saved quick-fill presets for common expenses.",
    },
    async () => {
      try {
        const quickFills = await getQuickFills(getManagementId());
        return ok(`Found ${quickFills.length} quick-fill preset${quickFills.length === 1 ? "" : "s"}.`, { quickFills });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_quick_fill",
    {
      title: "Create Quick Fill",
      description: "Create a reusable quick-fill preset.",
      inputSchema: {
        name: z.string().trim().min(1),
        nominal: z.number().positive(),
        categoryId: z.string().min(1).nullable().optional(),
      },
    },
    async ({ name, nominal, categoryId }) => {
      try {
        const quickFill = await createQuickFill({ name, nominal, categoryId, managementId: getManagementId() });
        return ok("Created quick-fill preset.", quickFill);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "delete_quick_fill",
    {
      title: "Delete Quick Fill",
      description: "Permanently delete a quick-fill preset by ID. This cannot be undone.",
      inputSchema: { id: z.string().min(1).describe("Quick-fill preset ID") },
    },
    async ({ id }) => {
      try {
        await deleteQuickFill(id);
        return ok("Deleted quick-fill preset.", { id });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
