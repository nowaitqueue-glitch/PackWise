/**
 * Generates src/data/countries.json from i18n-iso-countries (ISO 3166-1 alpha-2).
 * Run: node scripts/generate-countries.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const countries = require("i18n-iso-countries");
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

const POPULAR_CODES = [
  "US",
  "GB",
  "FR",
  "DE",
  "JP",
  "AE",
  "CA",
  "AU",
  "ES",
  "IT",
  "NL",
  "CH",
  "MX",
  "BR",
  "IN",
  "KR",
  "SG",
  "NZ",
];

const names = countries.getNames("en", { select: "official" });
const all = Object.entries(names)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const byCode = new Map(all.map((c) => [c.code, c]));
const popular = POPULAR_CODES.map((code) => byCode.get(code)).filter(Boolean);
const popularSet = new Set(POPULAR_CODES);
const rest = all.filter((c) => !popularSet.has(c.code));

const ordered = [...popular, ...rest];

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "src", "data", "countries.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${ordered.length} countries to ${outPath} (${popular.length} popular first)`
);
