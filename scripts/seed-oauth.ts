import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const client = {
    clientId: "cashflow-app",
    clientName: "Cashflow Tracker",
    clientUri: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    redirectUris: [
      "http://localhost:3000/oauth/callback",
      "http://127.0.0.1:3000/oauth/callback",
    ],
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    scope: "cashflow:read cashflow:write lifeflow:read lifeflow:write",
    isPublic: true,
  };

  await prisma.oAuthClient.upsert({
    where: { clientId: client.clientId },
    create: client,
    update: {
      scope: client.scope,
      grantTypes: client.grantTypes,
      responseTypes: client.responseTypes,
    },
  });

  console.log("Default OAuth client seeded successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
