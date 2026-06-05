"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/management";

export type RegisteredUserOption = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export async function searchRegisteredUsers(query = ""): Promise<RegisteredUserOption[]> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { email: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, image: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 20,
  });
}
