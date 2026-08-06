import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { deleteManagement, renameManagement } from "@/app/actions/management";
import { prisma } from "@/lib/db";
import { isManagementCategory } from "@/lib/management-category";

async function getManagementForApi(managementId: string) {
  const management = await prisma.management.findUnique({
    where: { id: managementId },
    include: { _count: { select: { members: true } } },
  });
  if (!management) throw new Error("Management not found");

  return {
    id: management.id,
    name: management.name,
    category: management.category,
    image: management.image,
    memberCount: management._count.members,
    createdAt: management.createdAt.toISOString(),
    updatedAt: management.updatedAt.toISOString(),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    if (!body?.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    if (body.category !== undefined && body.category !== null && !isManagementCategory(body.category)) {
      return Response.json({ error: "invalid management category" }, { status: 400 });
    }
    await renameManagement(body.name, id, body.category);
    return ok(await getManagementForApi(id));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    return ok(await deleteManagement(id));
  } catch (error) {
    return handleError(error);
  }
}
