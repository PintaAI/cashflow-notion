import { notFound } from "next/navigation";

import { ToolsPageContent } from "@/components/tools/tools-page-content";
import { activateManagement } from "@/lib/management";

export default async function ManagementToolsPage({
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

  return <ToolsPageContent />;
}
