import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { getUserManagements, createManagement } from "@/app/actions/management";
import { prisma } from "@/lib/db";

async function getManagementForApi(managementId: string) {
  const management = await prisma.management.findUnique({
    where: { id: managementId },
    include: { _count: { select: { members: true } } },
  });
  if (!management) throw new Error("Management not found");

  return {
    id: management.id,
    name: management.name,
    image: management.image,
    memberCount: management._count.members,
    createdAt: management.createdAt.toISOString(),
    updatedAt: management.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await getUserManagements();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    if (!body?.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const result = await createManagement(body.name);
    return ok(await getManagementForApi(result.managementId), 201);
  } catch (error) {
    return handleError(error);
  }
}
