import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Ethos",
  description: "Privacy Policy for Ethos and the Cashflow Notion service.",
};

const lastUpdated = "July 6, 2026";

const sections = [
  {
    title: "Information we collect",
    body: [
      "Account information such as your name, email address, profile image, authentication provider, sessions, and app preferences.",
      "Financial workspace data that you create, including wallets, members, cashflow entries, categories, budgets, quick-fill presets, recurring entries, transfers, audit snapshots, currencies, and exchange-rate context.",
      "Notes and files that you create or upload, including note titles, note content, icons, shared-note membership, receipt images, wallet images, and profile images.",
      "Optional notification data such as push subscription tokens and the workspace context needed to send reminders you enable.",
      "Technical data such as device, browser, request, and service logs that help us secure, operate, debug, and improve the service.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To provide the Ethos app, sync data across your devices, authenticate your account, and keep your financial workspace available offline and online.",
      "To support collaboration features such as shared wallets, shared notes, invitations, member roles, and user search for invited collaborators.",
      "To process optional features you choose to use, such as image uploads, receipt extraction, split-bill assistance, transcription, reminders, and AI-assisted tools.",
      "To maintain security, prevent abuse, troubleshoot errors, improve reliability, and comply with legal obligations.",
    ],
  },
  {
    title: "Third-party services",
    body: [
      "We use service providers to operate the app, including hosting, database, object storage, authentication, realtime messaging, push notifications, and optional AI processing providers.",
      "When you sign in with Google or Apple, those providers process authentication according to their own privacy policies.",
      "When you use AI-assisted features, the content needed for that feature, such as receipt images or audio/transcript text, may be sent to the configured AI or transcription provider only to perform the requested action.",
      "We do not sell your personal information.",
    ],
  },
  {
    title: "Tracking and advertising",
    body: [
      "Ethos does not use third-party advertising SDKs and does not track you across apps or websites owned by other companies for advertising purposes.",
      "If this changes in the future, we will update this policy and the App Store privacy disclosures before enabling that behavior.",
    ],
  },
  {
    title: "Sharing and collaboration",
    body: [
      "If you join or invite others to a wallet or note, members of that shared workspace may be able to see the workspace data, member profile details, and activity that are necessary for collaboration.",
      "Do not add sensitive information to shared workspaces unless you intend other members to access it.",
    ],
  },
  {
    title: "Data retention and deletion",
    body: [
      "We keep account and workspace data while your account is active or as needed to provide the service.",
      "You can delete your account from inside Ethos. Account deletion removes your user account, sessions, OAuth tokens, private workspaces that have no remaining members, private notes that have no remaining members, and related push subscriptions.",
      "If a shared wallet or note has other members, ownership may be transferred or your membership may be removed so the remaining members can continue using the shared workspace.",
      "Some records may remain for a limited time in backups, logs, security records, or where retention is required by law.",
    ],
  },
  {
    title: "Security",
    body: [
      "We use authentication, access controls, secure storage, and encrypted transport to protect your information.",
      "No system can be guaranteed to be completely secure, so you should use a strong device passcode and keep your account providers secure.",
    ],
  },
  {
    title: "Children",
    body: [
      "Ethos is not directed to children under 13, and we do not knowingly collect personal information from children under 13.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "We may update this Privacy Policy when the app, service providers, or legal requirements change. The latest version will always be available on this page.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For privacy questions or deletion requests that cannot be completed inside the app, contact the developer through the support contact listed on the App Store product page.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-16">
      <article className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-medium text-muted-foreground">Last updated: {lastUpdated}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          This Privacy Policy explains how Ethos and the Cashflow Notion service collect, use, and protect information when you use the mobile app, web app, APIs, and related services.
        </p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
