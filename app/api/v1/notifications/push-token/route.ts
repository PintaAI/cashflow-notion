import { prisma } from "@/lib/db";
import { handleError, ok, requireSession } from "@/lib/api/helpers";

const EXPO_PUSH_TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[^\]]+\]$/;

export async function PUT(request: Request) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const platform = body?.platform;

    if (!EXPO_PUSH_TOKEN_PATTERN.test(token) || token.length > 512) {
      return Response.json({ error: "A valid Expo push token is required" }, { status: 400 });
    }
    if (platform !== "ios" && platform !== "android") {
      return Response.json({ error: "platform must be ios or android" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        activeManagementId: true,
        memberships: { select: { managementId: true } },
      },
    });
    const managementIds = new Set(user?.memberships.map((membership) => membership.managementId));
    const managementId = user?.activeManagementId && managementIds.has(user.activeManagementId)
      ? user.activeManagementId
      : user?.memberships[0]?.managementId ?? null;

    const stored = await prisma.expoPushToken.upsert({
      where: { token },
      create: { token, platform, userId: session.user.id, managementId },
      update: { platform, userId: session.user.id, managementId },
      select: { id: true, platform: true, managementId: true, updatedAt: true },
    });

    return ok(stored);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) {
      return Response.json({ error: "A valid Expo push token is required" }, { status: 400 });
    }

    const result = await prisma.expoPushToken.deleteMany({
      where: { token, userId: session.user.id },
    });
    return ok({ removed: result.count });
  } catch (error) {
    return handleError(error);
  }
}
