import { redirect } from "next/navigation";

import { getCurrentManagementId } from "@/lib/management";

export default async function ToolsPage() {
  const managementId = await getCurrentManagementId();
  redirect(`/dompet/${managementId}/tools`);
}
