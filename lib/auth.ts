import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import crypto from "crypto";
import { prisma } from "@/lib/db";

function generateApiKey(): string {
  return "mcp_" + crypto.randomBytes(32).toString("hex");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: ["https://jennie-linux.tail2268a1.ts.net"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  schema: {
    user: {
      additionalFields: {
        mcpApiKey: {
          type: "string",
          input: false,
          returned: true,
        },
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const name = user.name || user.email?.split("@")[0] || "User";
          await prisma.management.create({
            data: {
              name: `${name}'s Household`,
              members: {
                create: { userId: user.id, role: "owner" },
              },
            },
          });

          const mcpApiKey = generateApiKey();
          await prisma.user.update({
            where: { id: user.id },
            data: { mcpApiKey },
          });

          const orphanedCount = await prisma.entry.count({ where: { managementId: null } });
          if (orphanedCount > 0) {
            const management = await prisma.management.findFirst({
              where: { members: { some: { userId: user.id } } },
              orderBy: { createdAt: "asc" },
            });
            if (management) {
              await Promise.all([
                prisma.category.updateMany({ where: { managementId: null }, data: { managementId: management.id } }),
                prisma.entry.updateMany({ where: { managementId: null }, data: { managementId: management.id } }),
                prisma.quickFill.updateMany({ where: { managementId: null }, data: { managementId: management.id } }),
              ]);
            }
          }
        },
      },
    },
  },
});
