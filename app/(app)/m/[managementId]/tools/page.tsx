import { redirect } from "next/navigation";

export default async function LegacyManagementToolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ managementId: string }>;
  searchParams: Promise<{ tool?: string }>;
}) {
  const { managementId } = await params;
  const { tool } = await searchParams;
  if (tool === "transfer") {
    redirect(`/dompet/${managementId}/tools?tool=transfer`);
  }
  redirect(tool ? `/tools?tool=${encodeURIComponent(tool)}` : "/tools");
}
