import { ImageResponse } from "next/og";

import { SITE_URL } from "@/lib/site";

export const ogImageSize = { width: 1200, height: 630 };

export function createOgImage(locale: "id" | "en") {
  const isIndonesian = locale === "id";

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "70px 76px",
          overflow: "hidden",
          background: "#f3f2ec",
          color: "#101513",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ position: "absolute", right: -120, bottom: -220, width: 650, height: 650, borderRadius: 999, background: "#bdeedc" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "78%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* next/image is not supported by ImageResponse. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SITE_URL}/landing/ethos-icon.png`} alt="" width={72} height={72} style={{ borderRadius: 16 }} />
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.06em" }}>ethos</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ marginBottom: 18, color: "#16896e", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Cashflow + LifeFlow
            </span>
            <span style={{ fontSize: 70, fontWeight: 600, letterSpacing: "-0.055em", lineHeight: 0.98 }}>
              {isIndonesian ? "Uangmu terarah. Harimu tertata." : "Money in focus. Life in rhythm."}
            </span>
            <span style={{ marginTop: 24, color: "#5f6864", fontSize: 23 }}>
              ethos: organize your life within your hands
            </span>
          </div>
        </div>
        <div style={{ position: "absolute", right: 76, top: 72, display: "flex", padding: "10px 16px", border: "2px solid #101513", borderRadius: 999, fontSize: 17, fontWeight: 700 }}>
          {isIndonesian ? "Tersedia di App Store" : "Available on the App Store"}
        </div>
      </div>
    ),
    ogImageSize,
  );
}
