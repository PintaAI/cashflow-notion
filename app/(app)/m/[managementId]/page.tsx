import { redirect } from "next/navigation";

export default async function LegacyManagementPage({
  params,
}: {
  params: Promise<{ managementId: string }>;
}) {
  const { managementId } = await params;
  redirect(`/dompet/${managementId}`);
}
