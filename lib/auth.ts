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

          const defaultExpenseCategories = [
            { name: "Makanan", color: "#ef4444", icon: "utensils" },
            { name: "Transportasi", color: "#f97316", icon: "car" },
            { name: "Belanja", color: "#eab308", icon: "shopping-bag" },
            { name: "Tagihan", color: "#84cc16", icon: "receipt" },
            { name: "Hiburan", color: "#22c55e", icon: "music" },
            { name: "Kesehatan", color: "#14b8a6", icon: "heart" },
            { name: "Pendidikan", color: "#06b6d4", icon: "book" },
            { name: "Rumah Tangga", color: "#3b82f6", icon: "home" },
            { name: "Pakaian & Aksesoris", color: "#6366f1", icon: "shirt" },
            { name: "Asuransi", color: "#8b5cf6", icon: "shield" },
            { name: "Tabungan & Investasi", color: "#a855f7", icon: "piggy-bank" },
            { name: "Hadiah & Donasi", color: "#d946ef", icon: "gift" },
            { name: "Perjalanan", color: "#ec4899", icon: "plane" },
            { name: "Lainnya", color: "#64748b", icon: "more-horizontal" },
          ];
          const defaultIncomeCategories = [
            { name: "Gaji", color: "#22c55e", icon: "banknote" },
            { name: "Bonus", color: "#14b8a6", icon: "award" },
            { name: "Freelance", color: "#3b82f6", icon: "laptop" },
            { name: "Investasi", color: "#8b5cf6", icon: "trending-up" },
            { name: "Hadiah", color: "#ec4899", icon: "gift" },
            { name: "Lainnya Pemasukan", color: "#64748b", icon: "more-horizontal" },
          ];

          await prisma.category.createMany({
            data: [
              ...defaultExpenseCategories.map((c) => ({
                ...c,
                managementId: management.id,
              })),
              ...defaultIncomeCategories.map((c) => ({
                ...c,
                managementId: management.id,
              })),
            ],
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
