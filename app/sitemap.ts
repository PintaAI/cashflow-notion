import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-05");

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { "id-ID": SITE_URL, "en-US": `${SITE_URL}/en` } },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { "id-ID": SITE_URL, "en-US": `${SITE_URL}/en` } },
    },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy/id`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/support`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/support/id`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ];
}
