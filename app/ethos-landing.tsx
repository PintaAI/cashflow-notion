import Image from "next/image";
import Link from "next/link";

import styles from "./landing.module.css";
import { ScreenshotCarousel } from "./screenshot-carousel";
import { APP_STORE_URL, SITE_URL } from "@/lib/site";

const content = {
  id: {
    nav: { why: "Tentang Ethos", preview: "Preview", web: "Buka web app" },
    hero: {
      eyebrow: "Cashflow + LifeFlow",
      title: <>Organize your life,<br /><em>within your hands.</em></>,
      intro: "Satu app untuk mengelola uang bersama dan menata kehidupan personal. Ethos menyatukan Cashflow dan LifeFlow dalam satu pengalaman yang mudah digunakan.",
      store: "Unduh di",
      platform: <>Gratis di iPhone<br />iOS 16.4+</>,
      sideNote: <>Uang terarah.<br />Hidup tertata.</>,
      balanceLabel: "Shared wallet",
      balanceValue: "In sync",
      balanceNote: "Pasangan, keluarga, dan teman",
    },
    pillars: {
      kicker: "Dua flow · Satu hidup",
      title: <>Uangmu terarah.<br /><em>Harimu tertata.</em></>,
      items: [
        {
          number: "01",
          label: "Money management",
          title: "Cashflow",
          body: "Cashflow app yang mudah digunakan untuk mencatat income dan expense, mengatur budget, melihat analytics, dan memahami pola keuanganmu.",
          detail: "Buat shared wallet bersama pasangan, keluarga, atau teman agar semua orang bisa mencatat transaksi dan memantau balance yang sama.",
          tags: ["Shared wallet", "Budget", "Analytics"],
        },
        {
          number: "02",
          label: "Personal life management",
          title: "LifeFlow",
          body: "Ruang personal untuk menjaga ritme hidup. Bangun habits, tulis journal, dan susun scheduling tanpa berpindah-pindah app.",
          detail: "Lihat apa yang perlu dilakukan hari ini, jaga konsistensi, dan beri ruang untuk refleksi dalam satu flow yang tenang.",
          tags: ["Habits", "Journal", "Scheduling"],
        },
      ],
    },
    preview: {
      eyebrow: "Satu app · Dua flow",
      title: <>Your whole life,<br /><em>crystal clear.</em></>,
      body: "Berpindah dari Cashflow ke LifeFlow dengan mudah. Uang, habits, journal, dan schedule penting selalu ada dalam jangkauan.",
      link: "Lihat Ethos di App Store",
    },
    final: {
      kicker: <>Cashflow in sync.<br />LifeFlow on track.</>,
      title: <>ethos: organize your life<br /><em>within your hands.</em></>,
      store: "Unduh di",
    },
    footer: { privacy: "Privasi", support: "Bantuan" },
  },
  en: {
    nav: { why: "Why Ethos", preview: "Preview", web: "Open web app" },
    hero: {
      eyebrow: "Cashflow + LifeFlow",
      title: <>Organize your life,<br /><em>within your hands.</em></>,
      intro: "One app for managing money together and organizing your personal life. Ethos brings Cashflow and LifeFlow into one easy-to-use experience.",
      store: "Download on the",
      platform: <>Free on iPhone<br />iOS 16.4+</>,
      sideNote: <>Clear money.<br />Calmer life.</>,
      balanceLabel: "Shared wallet",
      balanceValue: "In sync",
      balanceNote: "Partners, families, and friends",
    },
    pillars: {
      kicker: "Two flows · One life",
      title: <>Money in focus.<br /><em>Life in rhythm.</em></>,
      items: [
        {
          number: "01",
          label: "Money management",
          title: "Cashflow",
          body: "An easy-to-use Cashflow app for tracking income and expenses, setting budgets, viewing analytics, and understanding your money patterns.",
          detail: "Create a shared wallet with your partner, family, or friends so everyone can record transactions and follow the same balance.",
          tags: ["Shared wallet", "Budgets", "Analytics"],
        },
        {
          number: "02",
          label: "Personal life management",
          title: "LifeFlow",
          body: "A personal space for keeping life in rhythm. Build habits, write your journal, and manage scheduling without jumping between apps.",
          detail: "See what matters today, stay consistent, and make room for reflection through one calm, connected flow.",
          tags: ["Habits", "Journal", "Scheduling"],
        },
      ],
    },
    preview: {
      eyebrow: "One app · Two flows",
      title: <>Your whole life,<br /><em>crystal clear.</em></>,
      body: "Move seamlessly between Cashflow and LifeFlow. Your money, habits, journal, and important schedules are always within reach.",
      link: "Explore Ethos on the App Store",
    },
    final: {
      kicker: <>Cashflow in sync.<br />LifeFlow on track.</>,
      title: <>ethos: organize your life<br /><em>within your hands.</em></>,
      store: "Download on the",
    },
    footer: { privacy: "Privacy", support: "Support" },
  },
} as const;

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 12.54c-.03-3.17 2.59-4.71 2.71-4.78a5.8 5.8 0 0 0-4.57-2.47c-1.92-.2-3.79 1.15-4.77 1.15-1 0-2.51-1.13-4.14-1.1a6.1 6.1 0 0 0-5.13 3.12c-2.21 3.83-.56 9.46 1.56 12.56 1.06 1.52 2.29 3.22 3.92 3.16 1.59-.07 2.18-1.02 4.1-1.02 1.9 0 2.46 1.02 4.12.98 1.72-.03 2.8-1.52 3.82-3.05a12.56 12.56 0 0 0 1.75-3.56 5.46 5.46 0 0 1-3.37-4.99ZM13.94 3.25A5.53 5.53 0 0 0 15.2-.72a5.64 5.64 0 0 0-3.65 1.89 5.28 5.28 0 0 0-1.29 3.83 4.66 4.66 0 0 0 3.68-1.75Z" />
    </svg>
  );
}

function AppStoreButton({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <a className={`${styles.storeButton} ${compact ? styles.storeButtonCompact : ""}`} href={APP_STORE_URL} target="_blank" rel="noreferrer" aria-label={`${label} App Store`}>
      <AppleIcon />
      <span><small>{label}</small><strong>App Store</strong></span>
    </a>
  );
}

export function EthosLanding({ locale }: { locale: "id" | "en" }) {
  const copy = content[locale];
  const homePath = locale === "id" ? "/" : "/en";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: "ethos: Life OS",
    alternateName: "Ethos",
    description: locale === "id"
      ? "Cashflow dengan shared wallet dan LifeFlow untuk habits, journal, serta scheduling."
      : "Cashflow with shared wallets and LifeFlow for habits, journaling, and scheduling.",
    url: `${SITE_URL}${homePath === "/" ? "" : homePath}`,
    downloadUrl: APP_STORE_URL,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "iOS 16.4 or later",
    inLanguage: locale === "id" ? "id-ID" : "en-US",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Person", name: "Rores Sagella" },
    featureList: locale === "id"
      ? ["Shared wallet", "Cashflow tracking", "Budget dan analytics", "Habits", "Journal", "Scheduling"]
      : ["Shared wallets", "Cashflow tracking", "Budgets and analytics", "Habits", "Journaling", "Scheduling"],
    screenshot: `${SITE_URL}/landing/${locale}/home_cashflow.jpg`,
  };

  return (
    <main className={styles.page} lang={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <nav className={styles.nav} aria-label="Main navigation">
        <Link className={styles.brand} href={homePath} aria-label="Ethos home">
          <Image src="/landing/ethos-icon.png" alt="" width={44} height={44} priority />
          <span>ethos</span>
        </Link>
        <div className={styles.navLinks}>
          <a href="#why-ethos">{copy.nav.why}</a>
          <a href="#preview">{copy.nav.preview}</a>
        </div>
        <div className={styles.navActions}>
          <div className={styles.languageLinks} aria-label="Language">
            <Link href="/" className={locale === "id" ? styles.languageActive : undefined}>ID</Link>
            <span>/</span>
            <Link href="/en" className={locale === "en" ? styles.languageActive : undefined}>EN</Link>
          </div>
          <Link className={styles.webLink} href="/auth">{copy.nav.web} <span aria-hidden="true">↗</span></Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> {copy.hero.eyebrow}</p>
          <h1>{copy.hero.title}</h1>
          <p className={styles.intro}>{copy.hero.intro}</p>
          <div className={styles.heroActions}>
            <AppStoreButton label={copy.hero.store} />
            <span className={styles.platformNote}>{copy.hero.platform}</span>
          </div>
        </div>
        <div className={styles.heroVisual} aria-label="Ethos app preview">
          <div className={styles.mintOrb} />
          <p className={styles.sideNote}>{copy.hero.sideNote}</p>
          <div className={styles.phoneFrame}>
            <Image src={`/landing/${locale}/home_cashflow.jpg`} alt={`Ethos Cashflow in ${locale === "id" ? "Indonesian" : "English"}`} width={590} height={1280} priority sizes="(max-width: 760px) 68vw, 300px" />
          </div>
          <div className={styles.balanceCard}>
            <span>{copy.hero.balanceLabel}</span>
            <strong>{copy.hero.balanceValue}</strong>
            <small><i /> {copy.hero.balanceNote}</small>
          </div>
        </div>
      </section>

      <section className={styles.manifesto} id="why-ethos">
        <p>{copy.pillars.kicker}</p>
        <h2>{copy.pillars.title}</h2>
        <div className={styles.pillarGrid}>
          {copy.pillars.items.map((item) => (
            <article key={item.number}>
              <header><span>{item.number}</span><small>{item.label}</small></header>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <p className={styles.pillarDetail}>{item.detail}</p>
              <div className={styles.pillarTags}>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.preview} id="preview">
        <div className={styles.previewCopy}>
          <p className={styles.eyebrow}><span /> {copy.preview.eyebrow}</p>
          <h2>{copy.preview.title}</h2>
          <div>
            <p>{copy.preview.body}</p>
            <a className={styles.textLink} href={APP_STORE_URL} target="_blank" rel="noreferrer">{copy.preview.link} <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <ScreenshotCarousel locale={locale} />
      </section>

      <section className={styles.finalCta}>
        <Image src="/landing/ethos-icon.png" alt="Ethos app icon" width={88} height={88} />
        <p>{copy.final.kicker}</p>
        <h2>{copy.final.title}</h2>
        <AppStoreButton label={copy.final.store} compact />
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}><Image src="/landing/ethos-icon.png" alt="" width={36} height={36} /><span>ethos</span></div>
        <p>© 2026 Rores Sagella</p>
        <div><Link href={locale === "id" ? "/privacy/id" : "/privacy"}>{copy.footer.privacy}</Link><Link href={locale === "id" ? "/support/id" : "/support"}>{copy.footer.support}</Link></div>
      </footer>
    </main>
  );
}
