import { redirect } from "next/navigation";

import { resolveManagementId } from "@/lib/management";

export default async function HomePage() {
  let managementId: string;
  try {
    managementId = await resolveManagementId();
  } catch {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1 className="text-3xl font-bold">Cloud sync belum aktif</h1>
        <p className="mt-3 text-muted-foreground">
          Masuk ke aplikasi Ethos untuk mencadangkan, menyinkronkan, dan berbagi dompet di seluruh perangkat Anda.
        </p>
      </main>
    );
  }
  redirect(`/dompet/${managementId}`);
}
