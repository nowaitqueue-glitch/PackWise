/**
 * Smoke-test static city lists (src/lib/cities.ts).
 * Usage: node scripts/smoke-get-cities.mjs
 *
 * Uses dynamic import of the compiled TS module via tsx if available,
 * otherwise reads and evaluates a minimal inline copy of the filter logic.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const citiesPath = join(__dirname, "../src/lib/cities.ts");

/** @type {Record<string, string[]>} */
let citiesByCountry;

try {
  const mod = await import("../src/lib/cities.ts");
  citiesByCountry = mod.citiesByCountry;
} catch {
  const source = readFileSync(citiesPath, "utf8");
  const match = source.match(
    /export const citiesByCountry[^=]*=\s*(\{[\s\S]*\});/
  );
  if (!match) {
    console.error("Could not load citiesByCountry from", citiesPath);
    process.exit(1);
  }
  citiesByCountry = Function(`return ${match[1]}`)();
}

function filterCities(countryCode, query) {
  const code = (countryCode || "").trim().toUpperCase();
  if (!code) return [];
  const all = citiesByCountry[code] || [];
  const q = (query || "").trim().toLowerCase();
  if (!q) return all;
  return all.filter((name) => name.toLowerCase().includes(q));
}

const countryCount = Object.keys(citiesByCountry).length;

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

console.log(`Static cities smoke (${countryCount} countries)\n`);

const jpAll = filterCities("JP", "");
console.log(`--- JP (empty query) → ${jpAll.length} cities ---`);
assert(jpAll.length >= 30, "JP should have at least 30 cities");
assert(jpAll.includes("Tokyo"), "JP should include Tokyo");
assert(jpAll.includes("Osaka"), "JP should include Osaka");

const osa = filterCities("JP", "Osa");
console.log(`--- JP + "Osa" → ${osa.length} matches: ${osa.join(", ")} ---`);
assert(osa.some((c) => /osaka/i.test(c)), 'Expected Osaka for "Osa"');

const phAll = filterCities("PH", "");
console.log(`--- PH (empty query) → ${phAll.length} cities ---`);
assert(phAll.length >= 30, "PH should have at least 30 cities");

const ceb = filterCities("PH", "Ceb");
console.log(`--- PH + "Ceb" → ${ceb.length} matches: ${ceb.join(", ")} ---`);
assert(ceb.some((c) => /cebu/i.test(c)), 'Expected Cebu for "Ceb"');

const ber = filterCities("DE", "Ber");
console.log(`--- DE + "Ber" → ${ber.length} matches: ${ber.slice(0, 5).join(", ")}... ---`);
assert(ber.some((c) => /ber/i.test(c)), 'Expected Berlin for "Ber"');

const unknown = filterCities("XX", "");
console.log(`--- XX (unknown country) → ${unknown.length} cities ---`);
assert(unknown.length === 0, "Unknown country should return empty list");

console.log("\nOK");
