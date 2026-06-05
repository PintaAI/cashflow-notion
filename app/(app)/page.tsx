import { redirect } from "next/navigation";

import { getCurrentManagementId } from "@/lib/management";

export default async function HomePage() {
  const managementId = await getCurrentManagementId();
  redirect(`/dompet/${managementId}`);
}
