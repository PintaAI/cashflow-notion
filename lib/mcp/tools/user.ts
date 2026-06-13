import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { prisma } from "@/lib/db";
import { ok, toolError, getUserId } from "@/lib/mcp/tools/utils";

export function registerUserTools(server: McpServer) {
  server.registerTool(
    "get_user_info",
    {
      title: "Get User Info",
      description: "Get the current user's name, email, and preferred currency.",
    },
    async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: getUserId() },
          select: { name: true, email: true, image: true, currency: true },
        });
        if (!user) throw new Error("User not found");
        return ok("User info.", { name: user.name, email: user.email, currency: user.currency });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "list_managements",
    {
      title: "List Managements (Dompet)",
      description: "List all wallets/managements the user belongs to.",
    },
    async () => {
      try {
        const memberships = await prisma.managementMember.findMany({
          where: { userId: getUserId() },
          include: { management: { select: { id: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        });
        const user = await prisma.user.findUnique({
          where: { id: getUserId() },
          select: { activeManagementId: true },
        });
        const items = memberships.map((m) => ({
          id: m.management.id,
          name: m.management.name,
          role: m.role,
          isActive: m.management.id === user?.activeManagementId,
        }));
        return ok(`Found ${items.length} management${items.length === 1 ? "" : "s"}.`, { managements: items });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
