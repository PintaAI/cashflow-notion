import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import styles from "./landing.module.css";

const APP_STORE_URL = "https://apps.apple.com/us/app/ethos-life-os/id6787773622";

export const metadata: Metadata = {
  title: "Ethos | Your money, in one place",
  description:
    "Track cashflow, understand spending, and manage shared wallets together with Ethos.",
};

const features = [
  {
    number: "01",
    title: "Shared, not complicated",
    body: "Kelola satu dompet bersama pasangan. Catat transaksi dan pantau saldo tanpa harus saling kirim spreadsheet.",
  },
  {
    number: "02",
    title: "See the whole picture",
    body: "Ringkasan dan analitik yang jernih membantu kamu memahami ke mana uang pergi, bukan sekadar mencatatnya.",
  },
  {
    number: "03",
    title: "Built for real life",
    body: "Atur budget, kategori, banyak dompet, transfer dana, dan lampirkan foto struk dalam satu tempat.",
  },
];

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 12.54c-.03-3.17 2.59-4.71 2.71-4.78a5.8 5.8 0 0 0-4.57-2.47c-1.92-.2-3.79 1.15-4.77 1.15-1 0-2.51-1.13-4.14-1.1a6.1 6.1 0 0 0-5.13 3.12c-2.21 3.83-.56 9.46 1.56 12.56 1.06 1.52 2.29 3.22 3.92 3.16 1.59-.07 2.18-1.02 4.1-1.02 1.9 0 2.46 1.02 4.12.98 1.72-.03 2.8-1.52 3.82-3.05a12.56 12.56 0 0 0 1.75-3.56 5.46 5.46 0 0 1-3.37-4.99ZM13.94 3.25A5.53 5.53 0 0 0 15.2-.72a5.64 5.64 0 0 0-3.65 1.89 5.28 5.28 0 0 0-1.29 3.83 4.66 4.66 0 0 0 3.68-1.75Z" />
    </svg>
  );
}

function AppStoreButton({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`${styles.storeButton} ${compact ? styles.storeButtonCompact : ""}`}
      href={APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Download Ethos on the App Store"
    >
      <AppleIcon />
      <span>
        <small>Download on the</small>
        <strong>App Store</strong>
      </span>
    </a>
  );
}

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link className={styles.brand} href="/" aria-label="Ethos home">
          <Image src="/landing/ethos-icon.jpg" alt="" width={44} height={44} priority />
          <span>ethos</span>
        </Link>

        <div className={styles.navLinks}>
          <a href="#why-ethos">Why Ethos</a>
          <a href="#preview">Preview</a>
        </div>

        <Link className={styles.webLink} href="/auth">
          Open web app <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> Life OS for your money</p>
          <h1>Money feels better when you&apos;re <em>in sync.</em></h1>
          <p className={styles.intro}>
            Catat cashflow, pahami pola belanja, dan kelola dompet bersama orang terdekat. Semua terasa lebih ringan di Ethos.
          </p>
          <div className={styles.heroActions}>
            <AppStoreButton />
            <span className={styles.platformNote}>Free on iPhone<br />iOS 16.4+</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Ethos app preview">
          <div className={styles.mintOrb} />
          <p className={styles.sideNote}>Clear money.<br />Calmer life.</p>
          <div className={styles.phoneFrame}>
            <Image
              src="/landing/overview.jpg"
              alt="Ethos cashflow overview screen"
              width={640}
              height={960}
              priority
              sizes="(max-width: 760px) 78vw, 430px"
            />
          </div>
          <div className={styles.balanceCard}>
            <span>All-time balance</span>
            <strong>$3,708.70</strong>
            <small><i /> Everything, at a glance</small>
          </div>
        </div>
      </section>

      <section className={styles.manifesto} id="why-ethos">
        <p>More than an expense tracker</p>
        <h2>A clear view of your money.<br /><em>A shared way forward.</em></h2>
        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.preview} id="preview">
        <div className={styles.previewCopy}>
          <p className={styles.eyebrow}><span /> Designed for clarity</p>
          <h2>Your cashflow,<br /><em>crystal clear.</em></h2>
          <p>
            Dari transaksi hari ini sampai pola pengeluaran bulanan, informasi penting selalu mudah ditemukan dan mudah dipahami.
          </p>
          <a className={styles.textLink} href={APP_STORE_URL} target="_blank" rel="noreferrer">
            Explore Ethos on App Store <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className={styles.screenGallery}>
          <figure className={styles.screenBack}>
            <Image src="/landing/analytics.jpg" alt="Ethos calendar view" width={640} height={960} sizes="(max-width: 760px) 60vw, 320px" />
          </figure>
          <figure className={styles.screenFront}>
            <Image src="/landing/shared-wallet.jpg" alt="Ethos spending analytics" width={640} height={960} sizes="(max-width: 760px) 68vw, 360px" />
          </figure>
        </div>
      </section>

      <section className={styles.finalCta}>
        <Image src="/landing/ethos-icon.jpg" alt="Ethos app icon" width={88} height={88} />
        <p>Spend with intention.<br />Plan life together.</p>
        <h2>Your money has a rhythm.<br /><em>Find it with Ethos.</em></h2>
        <AppStoreButton compact />
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}>
          <Image src="/landing/ethos-icon.jpg" alt="" width={36} height={36} />
          <span>ethos</span>
        </div>
        <p>© 2026 Rores Sagella</p>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/support">Support</Link>
        </div>
      </footer>
    </main>
  );
}
