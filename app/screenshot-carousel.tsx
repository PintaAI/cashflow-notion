"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import styles from "./landing.module.css";

const screenshots = [
  { file: "home_cashflow.jpg", title: "Cashflow" },
  { file: "entry.jpg", title: "Quick entry" },
  { file: "chart.jpg", title: "Insights" },
  { file: { en: "calender.jpg", id: "calendar.jpg" }, title: "Calendar" },
  { file: "home_lifeflow.jpg", title: "LifeFlow" },
  { file: "journal.jpg", title: "Journal" },
  { file: "habits.jpg", title: "Habits" },
  { file: "schedule.jpg", title: "Schedule" },
  { file: "widget.jpg", title: "Widgets" },
  { file: "sidebar.jpg", title: "Spaces" },
] as const;

export function ScreenshotCarousel({ locale }: { locale: "id" | "en" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function goTo(index: number) {
    const nextIndex = Math.max(0, Math.min(index, screenshots.length - 1));
    const track = trackRef.current;
    const item = track?.children[nextIndex] as HTMLElement | undefined;

    if (track && item) {
      track.scrollTo({ left: item.offsetLeft, behavior: "smooth" });
    }
    setActiveIndex(nextIndex);
  }

  function updateActiveSlide() {
    const track = trackRef.current;
    if (!track) return;

    const items = Array.from(track.children) as HTMLElement[];
    const closestIndex = items.reduce((closest, item, index) =>
      Math.abs(item.offsetLeft - track.scrollLeft) <
      Math.abs(items[closest].offsetLeft - track.scrollLeft)
        ? index
        : closest, 0);

    setActiveIndex(closestIndex);
  }

  return (
    <div className={styles.carousel}>
      <div className={styles.carouselToolbar}>
        <p className={styles.carouselLabel}>{locale === "id" ? "Tampilan aplikasi · Indonesia" : "App interface · English"}</p>

        <div className={styles.carouselArrows}>
          <span aria-live="polite">{String(activeIndex + 1).padStart(2, "0")} / {screenshots.length}</span>
          <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous screenshot">←</button>
          <button type="button" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex === screenshots.length - 1} aria-label="Next screenshot">→</button>
        </div>
      </div>

      <div
        ref={trackRef}
        className={styles.carouselTrack}
        onScroll={updateActiveSlide}
        tabIndex={0}
        aria-label={`${locale === "id" ? "Indonesian" : "English"} app screenshots`}
      >
        {screenshots.map((screenshot, index) => {
          const file = typeof screenshot.file === "string" ? screenshot.file : screenshot.file[locale];
          return (
            <figure className={styles.carouselSlide} key={`${locale}-${file}`}>
              <div className={styles.carouselImage}>
                <Image
                  src={`/landing/${locale}/${file}`}
                  alt={`${screenshot.title} screen in ${locale === "id" ? "Indonesian" : "English"}`}
                  fill
                  sizes="(max-width: 600px) 72vw, (max-width: 1000px) 36vw, 290px"
                />
              </div>
              <figcaption>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {screenshot.title}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className={styles.carouselDots} aria-label="Choose screenshot">
        {screenshots.map((screenshot, index) => (
          <button
            key={screenshot.title}
            type="button"
            className={activeIndex === index ? styles.dotActive : undefined}
            onClick={() => goTo(index)}
            aria-label={`Show ${screenshot.title}`}
            aria-current={activeIndex === index ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
