import { createOgImage, ogImageSize } from "./og-image";

export const alt = "Ethos Cashflow and LifeFlow";
export const size = ogImageSize;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createOgImage("id");
}
