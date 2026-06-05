import { notFound } from "next/navigation";

import { DashboardPage } from "./dashboard-page";
import { activateManagement } from "@/lib/management";

export default async function ManagementPage({
  params,
}: {
  params: Promise<{ managementId: string }>;
}) {
  const { managementId } = await params;

  try {
    await activateManagement(managementId);
  } catch {
    notFound();
  }

  return <DashboardPage />;
}
