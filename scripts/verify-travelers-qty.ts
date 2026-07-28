// Smoke-check traveler quantity scaling (4-day beach trip, 3 travelers).
// Run: npx --yes tsx scripts/verify-travelers-qty.ts

import {
  buildPackingProfile,
  searchPackingItems,
} from "../src/lib/packing-search";

const profile = buildPackingProfile({
  tripType: "beach",
  startDate: "2026-08-01",
  endDate: "2026-08-04",
  travelers: 3,
  weatherDays: [
    {
      highTemp: 30,
      lowTemp: 24,
      rainChance: 0.1,
      condition: "Clear",
    },
  ],
});

const items = searchPackingItems(profile);

function find(prefix: string) {
  return items.find(
    (item) => item.name === prefix || item.name.startsWith(`${prefix} (x`)
  );
}

console.log("Profile:", {
  tripDays: profile.tripDays,
  travelers: profile.travelers,
  tripType: profile.tripType,
  avgTemp: profile.avgTemp,
});
console.log(`Total items: ${items.length}`);
console.log("---");

const interesting = [
  "Passport / ID + photocopy",
  "Underwear",
  "Socks",
  "T-shirts / linen tops",
  "Shorts / light bottoms",
  "Swimwear",
  "Toiletries kit",
  "Sunscreen SPF 50+",
  "First-aid kit",
  "Phone & charger",
  "Travel insurance details",
] as const;

for (const name of interesting) {
  const item = find(name);
  if (!item) {
    console.log(`MISSING: ${name}`);
    continue;
  }
  console.log(item.name);
  if (item.notes) console.log(`  notes: ${item.notes}`);
}

const checks: Array<{
  name: string;
  expectName: string;
  noteIncludes?: string;
}> = [
  {
    name: "Passport / ID + photocopy",
    expectName: "Passport / ID + photocopy (x3)",
    noteIncludes: "One per traveler",
  },
  { name: "Underwear", expectName: "Underwear (x12)" },
  { name: "T-shirts / linen tops", expectName: "T-shirts / linen tops (x6)" },
  { name: "Shorts / light bottoms", expectName: "Shorts / light bottoms (x6)" },
  { name: "Swimwear", expectName: "Swimwear (x6)" },
  { name: "Toiletries kit", expectName: "Toiletries kit (x3)" },
  { name: "First-aid kit", expectName: "First-aid kit" },
  { name: "Phone & charger", expectName: "Phone & charger" },
];

let failed = 0;
console.log("--- assertions ---");
for (const check of checks) {
  const item = find(check.name);
  const okName = item?.name === check.expectName;
  const okNote =
    !check.noteIncludes ||
    (item?.notes?.includes(check.noteIncludes) ?? false);
  const ok = okName && okNote;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}: ${check.name} -> got "${item?.name ?? "MISSING"}"`
  );
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("\nAll assertions passed.");
