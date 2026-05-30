import { protectedResourceHandler } from "mcp-handler";

const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";

const handler = protectedResourceHandler({
  authServerUrls: [baseUrl],
});

export async function GET(req: Request) {
  return handler(req);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
