import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/en", "/privacy", "/privacy/id", "/support", "/support/id"],
      disallow: [
        "/admin",
        "/api/",
        "/auth",
        "/dompet/",
        "/invite",
        "/m/",
        "/notes",
        "/oauth/",
        "/tools",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
