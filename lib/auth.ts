import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { nextCookies } from "better-auth/next-js";
import crypto from "crypto";
import { importPKCS8, SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

function generateApiKey(): string {
  return "mcp_" + crypto.randomBytes(32).toString("hex");
}

async function generateAppleClientSecret(
  clientId: string,
  teamId: string,
  keyId: string,
  privateKey: string,
) {
  const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
}

const socialProviders = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  ...(process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY
    ? {
        apple: async () => ({
          clientId: process.env.APPLE_CLIENT_ID!,
          clientSecret: await generateAppleClientSecret(
            process.env.APPLE_CLIENT_ID!,
            process.env.APPLE_TEAM_ID!,
            process.env.APPLE_KEY_ID!,
            process.env.APPLE_PRIVATE_KEY!,
          ),
        }),
      }
    : {}),
};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "https://cashflow-notion.vercel.app",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: ["https://cashflow-notion.vercel.app", "https://jennie-linux.tail2268a1.ts.net", "https://appleid.apple.com", "ethos://", "ethos://*"],
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
  socialProviders,
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
