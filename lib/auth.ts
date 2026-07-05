import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { nextCookies } from "better-auth/next-js";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

function generateApiKey(): string {
  return "mcp_" + crypto.randomBytes(32).toString("hex");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: ["https://jennie-linux.tail2268a1.ts.net", "ethos://", "ethos://*"],
  emailAndPassword: {
    enabled: true,
  },
  account: {
    accountLinking: {
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
    },
  },
  plugins: [expo(), nextCookies()],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
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
        activeManagementId: {
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
          const management = await prisma.management.create({
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
            data: { mcpApiKey, activeManagementId: management.id },
          });

          await prisma.category.createMany({
            data: DEFAULT_CATEGORIES.map((category) => ({
              ...category,
              managementId: management.id,
            })),
          });

          const orphanedCount = await prisma.entry.count({ where: { managementId: null } });
          if (orphanedCount > 0) {
            await Promise.all([
              prisma.category.updateMany({ where: { managementId: null }, data: { managementId: management.id } }),
              prisma.entry.updateMany({ where: { managementId: null }, data: { managementId: management.id } }),
              prisma.quickFill.updateMany({ where: { managementId: null }, data: { managementId: management.id } }),
            ]);
          }
        },
      },
    },
  },
});
