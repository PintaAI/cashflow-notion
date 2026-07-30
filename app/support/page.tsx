import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support | Ethos",
  description: "Get help with Ethos and Cashflow Notion.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-16">
      <article className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Support</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Need help? Reach out to us at{" "}
          <a href="mailto:rorezxez@gmail.com" className="text-primary hover:underline">
            rorezxez@gmail.com
          </a>
        </p>
      </article>
    </main>
  );
}
