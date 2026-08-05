import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/** Public marketing / auth entry routes only - no dashboard or API. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/guest",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();

  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority:
      path === "/" ? 1 : path === "/login" || path === "/signup" ? 0.8 : 0.5,
  }));
}