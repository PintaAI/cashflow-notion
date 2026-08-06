import { ManagementCategory } from "@prisma/client";

export function isManagementCategory(value: unknown): value is ManagementCategory {
  return typeof value === "string" && Object.values(ManagementCategory).includes(value as ManagementCategory);
}
