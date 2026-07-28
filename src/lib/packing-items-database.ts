/**
 * Tag-based packing item database (local only — no APIs / AI).
 *
 * Items are selected by {@link searchPackingItems} via tags such as
 * "mandatory", "all", trip-type tags, weather tags, and flight tags.
 */

export const PACKING_CATEGORIES = [
  "Documents",
  "In-Flight",
  "Clothing",
  "Footwear",
  "Toiletries",
  "Health",
  "Electronics",
  "Comfort",
  "Miscellaneous",
] as const;

export type PackingCategory = (typeof PACKING_CATEGORIES)[number];

/** Render / sort order for packing lists. */
export const PACKING_CATEGORY_ORDER: readonly PackingCategory[] =
  PACKING_CATEGORIES;

export type QuantityRule = {
  type: "perDay" | "perDays" | "fixed";
  value: number;
};

/**
 * How traveler count scales the resolved day/fixed quantity:
 * - per_person — 1 (or fixed rule) × travelers (e.g. passport)
 * - per_person_consumable — day-based or base qty × travelers (clothing, toiletries)
 * - shared — trip-level qty, not multiplied (e.g. first-aid kit)
 *
 * When omitted, {@link searchPackingItems} infers from category (Clothing /
 * Toiletries → per-person modes; everything else → shared).
 */
export type QuantityMode = "per_person" | "shared" | "per_person_consumable";

export type PackingDatabaseItem = {
  name: string;
  category: PackingCategory;
  tags: string[];
  quantityRule?: QuantityRule;
  quantityMode?: QuantityMode;
  notes?: string;
  affiliateLink?: string;
};

/**
 * Curated packing catalog. Tags drive inclusion; quantityRule scales clothing
 * and consumables to trip length when present; quantityMode scales by travelers.
 */
export const PACKING_ITEMS: PackingDatabaseItem[] = [
  /* ------------------------------------------------------------------ */
  /* Documents — universal                                              */
  /* ------------------------------------------------------------------ */
  {
    name: "Passport / ID + photocopy",
    category: "Documents",
    tags: ["mandatory", "all"],
    quantityMode: "per_person",
    quantityRule: { type: "fixed", value: 1 },
    notes: "One per traveler. Keep a paper or photo copy separate from the original",
  },
  {
    name: "Travel insurance details",
    category: "Documents",
    tags: ["mandatory", "all"],
    quantityMode: "shared",
    notes: "Policy number and 24/7 assistance line",
  },
  {
    name: "Emergency contact card",
    category: "Documents",
    tags: ["mandatory", "all"],
    quantityMode: "per_person",
    quantityRule: { type: "fixed", value: 1 },
    notes: "One per traveler. Key contacts and any medical info, in case your phone dies",
  },
  {
    name: "Cash & cards",
    category: "Documents",
    tags: ["mandatory", "all"],
    quantityMode: "per_person",
    quantityRule: { type: "fixed", value: 1 },
    notes: "One per traveler. Some local currency plus a backup card stored separately",
  },
  {
    name: "Boarding passes / tickets",
    category: "Documents",
    tags: ["mandatory", "flight"],
    quantityMode: "per_person",
    quantityRule: { type: "fixed", value: 1 },
    notes: "One per traveler. Digital copies offline plus a printed backup if useful",
  },
  {
    name: "Business cards",
    category: "Documents",
    tags: ["business"],
    notes: "Or a digital contact QR code",
  },
  {
    name: "Work documents & printouts",
    category: "Documents",
    tags: ["business"],
    notes: "Agendas, contracts, or presentation backups",
  },

  /* ------------------------------------------------------------------ */
  /* In-Flight                                                          */
  /* ------------------------------------------------------------------ */
  {
    name: "Empty water bottle (reusable, collapsible)",
    category: "In-Flight",
    tags: ["mandatory", "flight"],
    notes: "Fill after security",
  },
  {
    name: "Pen",
    category: "In-Flight",
    tags: ["mandatory", "flight"],
    notes: "For immigration forms",
  },
  {
    name: "Wet wipes or hand sanitiser",
    category: "In-Flight",
    tags: ["mandatory", "flight"],
    notes: "Freshen up and wipe down your tray table",
  },
  {
    name: "Snacks (granola bars, nuts, or dried fruit)",
    category: "In-Flight",
    tags: ["flight", "longFlight"],
    notes: "Avoid liquids over 100ml if carry-on",
  },
  {
    name: "Earplugs or noise-cancelling earbuds",
    category: "In-Flight",
    tags: ["flight", "longFlight"],
    notes: "Essential for noisy cabins",
  },
  {
    name: "Eye mask",
    category: "In-Flight",
    tags: ["longFlight"],
    notes: "For sleeping on long flights",
  },
  {
    name: "Neck pillow (inflatable or memory foam)",
    category: "In-Flight",
    tags: ["longFlight"],
    notes: "Support for napping upright in your seat",
  },
  {
    name: "Compression socks",
    category: "In-Flight",
    tags: ["longFlight"],
    notes: "Improves circulation on long flights",
  },
  {
    name: "Lip balm & hand cream",
    category: "In-Flight",
    tags: ["longFlight"],
    notes: "Cabin air is very dry",
  },
  {
    name: "Entertainment (tablet, e-reader, or downloads)",
    category: "In-Flight",
    tags: ["longFlight"],
    notes: "Download before flight",
  },
  {
    name: "Charging cable (seat USB)",
    category: "In-Flight",
    tags: ["longFlight"],
    notes: "For seat USB/power port",
  },

  /* ------------------------------------------------------------------ */
  /* Clothing — core / all                                              */
  /* ------------------------------------------------------------------ */
  {
    name: "Underwear",
    category: "Clothing",
    tags: ["mandatory", "all"],
    quantityRule: { type: "perDay", value: 1 },
    notes: "One per day; pack a spare if you can",
  },
  {
    name: "Socks",
    category: "Clothing",
    tags: ["mandatory", "all"],
    quantityRule: { type: "perDay", value: 1 },
    notes: "Everyday pairs, one per day plus a spare if possible",
  },
  {
    name: "Sleepwear / pyjamas",
    category: "Clothing",
    tags: ["mandatory", "all"],
    notes: "Comfortable for the climate",
  },
  {
    name: "Everyday tops",
    category: "Clothing",
    tags: ["all", "leisure", "city"],
    quantityRule: { type: "perDays", value: 2 },
    notes: "Layerable for a range of conditions",
  },
  {
    name: "Everyday bottoms",
    category: "Clothing",
    tags: ["all", "leisure", "city"],
    quantityRule: { type: "perDays", value: 3 },
    notes: "Comfortable and easy to restyle",
  },
  {
    name: "Extra top (just in case)",
    category: "Clothing",
    tags: ["all"],
    notes:
      "Packing tip: include 1 extra top in case of unexpected rain or sweat",
  },
  {
    name: "Light jacket or cardigan",
    category: "Clothing",
    tags: ["all", "city", "leisure"],
    notes: "For cooler evenings and air-conditioning",
  },
  {
    name: "Sunglasses",
    category: "Clothing",
    tags: ["all", "UV", "hot", "beach", "city"],
    notes: "UV protection / glare on bright days",
  },

  /* Clothing — weather */
  {
    name: "Lightweight breathable clothing",
    category: "Clothing",
    tags: ["hot"],
    notes: "Loose, moisture-wicking fabrics for the heat",
  },
  {
    name: "Quick-dry tee",
    category: "Clothing",
    tags: ["hot", "humid"],
    quantityRule: { type: "perDays", value: 2 },
    notes: "Dries fast after sweat or a rinse",
  },
  {
    name: "Warm insulated coat",
    category: "Clothing",
    tags: ["cold"],
    notes: "Insulated enough for near-freezing days",
  },
  {
    name: "Scarf, gloves & beanie",
    category: "Clothing",
    tags: ["cold"],
    notes: "Wind and cold protection for extremities",
  },
  {
    name: "Thermal base layers",
    category: "Clothing",
    tags: ["cold", "veryCold", "ski"],
    notes: "Top and bottom for cold mornings",
  },
  {
    name: "Thermal underwear (top & bottom)",
    category: "Clothing",
    tags: ["veryCold"],
    notes: "Essential base warmth below -5°C",
  },
  {
    name: "Thick wool scarf",
    category: "Clothing",
    tags: ["veryCold"],
    notes: "Seals in warmth around the neck",
  },
  {
    name: "Waterproof rain jacket",
    category: "Clothing",
    tags: ["rain", "humid"],
    notes: "Packable shell to stay dry",
  },
  {
    name: "Wide-brimmed sun hat",
    category: "Clothing",
    tags: ["UV", "hot", "beach"],
    notes: "Shades face, ears, and neck under strong sun",
  },

  /* Clothing — beach */
  {
    name: "Swimwear",
    category: "Clothing",
    tags: ["beach", "swim"],
    quantityRule: { type: "perDays", value: 2 },
    notes: "Allow one set to dry while wearing another",
  },
  {
    name: "T-shirts / linen tops",
    category: "Clothing",
    tags: ["beach", "hot"],
    quantityRule: { type: "perDays", value: 2 },
    notes: "Light, breathable everyday tops",
  },
  {
    name: "Shorts / light bottoms",
    category: "Clothing",
    tags: ["beach", "hot"],
    quantityRule: { type: "perDays", value: 3 },
    notes: "Quick-drying and comfortable in heat",
  },
  {
    name: "Beach cover-up / kaftan",
    category: "Clothing",
    tags: ["beach", "swim"],
    notes: "For sun breaks and air-conditioned spaces",
  },
  {
    name: "Rash guard",
    category: "Clothing",
    tags: ["beach", "swim", "UV"],
    notes: "Sun and abrasion protection in the water",
  },
  {
    name: "Sun hat",
    category: "Clothing",
    tags: ["beach", "UV"],
    notes: "Shade for face and neck",
  },

  /* Clothing — business */
  {
    name: "Suit jacket / blazer",
    category: "Clothing",
    tags: ["business"],
    notes: "Coordinates with your trousers or skirts",
  },
  {
    name: "Dress shirts / blouses",
    category: "Clothing",
    tags: ["business"],
    quantityRule: { type: "perDays", value: 2 },
    notes: "Roughly one for every two meeting days",
  },
  {
    name: "Trousers / skirts",
    category: "Clothing",
    tags: ["business"],
    quantityRule: { type: "perDays", value: 3 },
    notes: "Mix to restyle outfits across days",
  },
  {
    name: "Tie / belt",
    category: "Clothing",
    tags: ["business"],
    notes: "Accessories to finish the look",
  },
  {
    name: "Smart-casual outfit",
    category: "Clothing",
    tags: ["business", "city"],
    notes: "For dinners or travel days",
  },

  /* Clothing — ski */
  {
    name: "Thermal base layer top",
    category: "Clothing",
    tags: ["ski", "snow"],
    notes: "Moisture-wicking first layer",
  },
  {
    name: "Thermal base layer bottoms",
    category: "Clothing",
    tags: ["ski", "snow"],
    notes: "Keeps legs warm under ski pants",
  },
  {
    name: "Ski jacket",
    category: "Clothing",
    tags: ["ski", "snow"],
    notes: "Waterproof and insulated",
  },
  {
    name: "Ski pants / salopettes",
    category: "Clothing",
    tags: ["ski", "snow"],
    notes: "Waterproof outer layer for legs",
  },
  {
    name: "Fleece / mid-layer",
    category: "Clothing",
    tags: ["ski", "cold", "hiking"],
    notes: "Adjustable warmth between base and shell",
  },
  {
    name: "Ski socks",
    category: "Clothing",
    tags: ["ski", "snow"],
    quantityRule: { type: "perDay", value: 1 },
    notes: "Tall, warm pairs — roughly one per ski day",
  },
  {
    name: "Neck gaiter / balaclava",
    category: "Clothing",
    tags: ["ski", "snow", "veryCold"],
    notes: "Face and neck wind protection",
  },
  {
    name: "Gloves / mittens",
    category: "Clothing",
    tags: ["ski", "snow", "cold"],
    notes: "Waterproof, with liners if possible",
  },
  {
    name: "Swimsuit (spa / après)",
    category: "Clothing",
    tags: ["ski"],
    notes: "For the hot tub or spa après-ski",
  },

  /* Clothing — hiking */
  {
    name: "Moisture-wicking t-shirts",
    category: "Clothing",
    tags: ["hiking"],
    quantityRule: { type: "perDays", value: 2 },
    notes: "Dry faster than cotton on the trail",
  },
  {
    name: "Hiking trousers / shorts",
    category: "Clothing",
    tags: ["hiking"],
    notes: "Convertible pairs adapt to the weather",
  },
  {
    name: "Waterproof jacket & trousers",
    category: "Clothing",
    tags: ["hiking", "rain"],
    notes: "Weather can change quickly outdoors",
  },
  {
    name: "Wool hiking socks",
    category: "Clothing",
    tags: ["hiking"],
    quantityRule: { type: "perDay", value: 1 },
    notes: "Cushioned pairs, one per day plus a spare if possible",
  },
  {
    name: "Hat (sun hat or beanie)",
    category: "Clothing",
    tags: ["hiking"],
    notes: "Match to the forecast temperature",
  },
  {
    name: "Light trail gloves",
    category: "Clothing",
    tags: ["hiking", "cold"],
    notes: "For chilly mornings and ridges",
  },

  /* Clothing — city */
  {
    name: "Mix-and-match tops",
    category: "Clothing",
    tags: ["city"],
    quantityRule: { type: "perDays", value: 2 },
    notes: "Layerable pieces for changeable mild weather",
  },
  {
    name: "Versatile bottoms",
    category: "Clothing",
    tags: ["city"],
    quantityRule: { type: "perDays", value: 3 },
    notes: "Jeans or trousers that pair with everything",
  },
  {
    name: "One smart outfit",
    category: "Clothing",
    tags: ["city", "leisure"],
    notes: "For a nicer dinner or evening out",
  },

  /* ------------------------------------------------------------------ */
  /* Footwear                                                           */
  /* ------------------------------------------------------------------ */
  {
    name: "Comfortable walking shoes",
    category: "Footwear",
    tags: ["all", "city", "leisure", "business"],
    notes: "Expect long days on foot",
  },
  {
    name: "Flip-flops / sandals",
    category: "Footwear",
    tags: ["beach", "swim", "hot"],
    notes: "Easy on/off for sand and pool",
  },
  {
    name: "Walking sandals / trainers",
    category: "Footwear",
    tags: ["beach"],
    notes: "For excursions away from the beach",
  },
  {
    name: "Dress shoes",
    category: "Footwear",
    tags: ["business"],
    notes: "Polished and broken in",
  },
  {
    name: "Comfortable travel shoes",
    category: "Footwear",
    tags: ["business", "flight"],
    notes: "Airport and walking between venues",
  },
  {
    name: "Dressier evening shoes",
    category: "Footwear",
    tags: ["city"],
    notes: "Pack flat to save space",
  },
  {
    name: "Hiking boots / trail shoes",
    category: "Footwear",
    tags: ["hiking"],
    notes: "Broken in well before the trip",
  },
  {
    name: "Insulated après-ski boots",
    category: "Footwear",
    tags: ["ski", "snow"],
    notes: "Warm, grippy soles for icy walkways",
  },
  {
    name: "Insulated winter boots",
    category: "Footwear",
    tags: ["veryCold", "snow"],
    notes: "Warm, waterproof, and grippy on ice",
  },
  {
    name: "Waterproof shoe covers",
    category: "Footwear",
    tags: ["rain"],
    notes: "Keep footwear dry in downpours",
  },
  {
    name: "Extra pair of shoes",
    category: "Footwear",
    tags: ["longTrip"],
    notes: "Rotate footwear over a longer stay",
  },
  {
    name: "Backup pair of shoes",
    category: "Footwear",
    tags: ["leisure", "rain"],
    notes: "In case the main pair gets wet",
  },

  /* ------------------------------------------------------------------ */
  /* Toiletries                                                         */
  /* ------------------------------------------------------------------ */
  {
    name: "Toiletries kit",
    category: "Toiletries",
    tags: ["mandatory", "all"],
    quantityMode: "per_person_consumable",
    quantityRule: { type: "fixed", value: 1 },
    notes: "Toothbrush, toothpaste, deodorant, basic skincare",
  },
  {
    name: "Sunscreen SPF 50+",
    category: "Toiletries",
    tags: ["UV", "hot", "beach", "ski"],
    quantityMode: "per_person_consumable",
    quantityRule: { type: "fixed", value: 1 },
    notes: "Reapply often; reef-safe if swimming outdoors",
  },
  {
    name: "After-sun lotion",
    category: "Toiletries",
    tags: ["beach", "UV", "hot"],
    quantityMode: "per_person_consumable",
    quantityRule: { type: "fixed", value: 1 },
    notes: "Soothes skin after sun exposure",
  },
  {
    name: "Aloe vera gel",
    category: "Toiletries",
    tags: ["beach", "UV"],
    quantityMode: "per_person_consumable",
    quantityRule: { type: "fixed", value: 1 },
    notes: "Extra relief for any sunburn",
  },
  {
    name: "Lip balm with SPF",
    category: "Toiletries",
    tags: ["ski", "cold", "UV"],
    quantityMode: "per_person_consumable",
    quantityRule: { type: "fixed", value: 1 },
    notes: "High-altitude sun and wind",
  },
  {
    name: "Lip balm",
    category: "Toiletries",
    tags: ["veryCold", "cold", "longFlight"],
    quantityMode: "per_person_consumable",
    quantityRule: { type: "fixed", value: 1 },
    notes: "Cold or dry air chaps lips quickly",
  },
  {
    name: "Wrinkle-release spray",
    category: "Toiletries",
    tags: ["business"],
    quantityMode: "shared",
    notes: "Freshen garments without an iron",
  },
  {
    name: "Extra toiletries (shampoo, conditioner)",
    category: "Toiletries",
    tags: ["longTrip"],
    quantityMode: "per_person_consumable",
    quantityRule: { type: "fixed", value: 1 },
    notes: "Full-size or refills so you don't run out",
  },

  /* ------------------------------------------------------------------ */
  /* Health                                                             */
  /* ------------------------------------------------------------------ */
  {
    name: "Basic medications",
    category: "Health",
    tags: ["mandatory", "all"],
    notes: "Pain reliever, plasters, anti-diarrheal, and any prescriptions",
  },
  {
    name: "Insect repellent",
    category: "Health",
    tags: ["beach", "hiking", "humid", "hot"],
    notes: "Mosquitoes, ticks, and evening bugs",
  },
  {
    name: "First-aid kit",
    category: "Health",
    tags: ["hiking", "all"],
    quantityMode: "shared",
    quantityRule: { type: "fixed", value: 1 },
    notes: "Shared kit — antiseptic, bandages, tape, and any medication",
  },
  {
    name: "Blister plasters",
    category: "Health",
    tags: ["hiking", "city"],
    notes: "Treat hot spots before they worsen",
  },
  {
    name: "Water purification tablets",
    category: "Health",
    tags: ["hiking"],
    notes: "Backup safe water on longer routes",
  },
  {
    name: "Emergency blanket",
    category: "Health",
    tags: ["hiking", "cold"],
    notes: "Compact foil blanket for unexpected stops",
  },
  {
    name: "Hand & toe warmers",
    category: "Health",
    tags: ["ski", "veryCold", "cold"],
    notes: "Disposable warmers for cold days",
  },
  {
    name: "Anti-chafing cream / balm",
    category: "Health",
    tags: ["humid", "hot", "hiking"],
    notes: "Prevents rubbing in hot, humid weather",
  },

  /* ------------------------------------------------------------------ */
  /* Electronics                                                        */
  /* ------------------------------------------------------------------ */
  {
    name: "Phone & charger",
    category: "Electronics",
    tags: ["mandatory", "all"],
    notes: "Your primary charging cable and plug",
  },
  {
    name: "Universal power adapter",
    category: "Electronics",
    tags: ["mandatory", "all"],
    notes: "Covers the destination's plug type",
  },
  {
    name: "Power bank",
    category: "Electronics",
    tags: ["mandatory", "all"],
    notes: "For long travel days and sightseeing",
  },
  {
    name: "Laptop & charger",
    category: "Electronics",
    tags: ["business"],
    notes: "Plus any HDMI / USB-C adapters you present with",
  },
  {
    name: "Noise-cancelling headphones",
    category: "Electronics",
    tags: ["business", "longFlight"],
    notes: "Focus on flights and in the hotel",
  },
  {
    name: "Waterproof phone pouch",
    category: "Electronics",
    tags: ["beach", "swim", "rain"],
    notes: "Protect your phone near sand, water, or rain",
  },
  {
    name: "Waterproof bag for electronics",
    category: "Electronics",
    tags: ["humid", "rain"],
    notes: "Shields devices from downpours and humidity",
  },
  {
    name: "Headlamp (+ spare batteries)",
    category: "Electronics",
    tags: ["hiking"],
    notes: "Hands-free light for early starts or delays",
  },
  {
    name: "Spare phone cable",
    category: "Electronics",
    tags: ["longTrip"],
    notes: "Backup for a long trip's daily charging",
  },

  /* ------------------------------------------------------------------ */
  /* Comfort                                                            */
  /* ------------------------------------------------------------------ */
  {
    name: "Beach towel",
    category: "Comfort",
    tags: ["beach", "swim"],
    notes: "Quick-dry packs smaller",
  },
  {
    name: "Snorkel & mask",
    category: "Comfort",
    tags: ["beach", "swim"],
    notes: "Optional — rent at the destination if you'd rather travel light",
  },
  {
    name: "Sand-free beach mat",
    category: "Comfort",
    tags: ["beach"],
    notes: "Optional but keeps sand off your gear",
  },
  {
    name: "Guidebook / phrasebook",
    category: "Comfort",
    tags: ["city"],
    notes: "Handy for context and basic phrases",
  },
  {
    name: "Offline city map & tickets",
    category: "Comfort",
    tags: ["city"],
    notes: "Download maps and store any booked entries",
  },
  {
    name: "Book / e-reader / downloaded media",
    category: "Comfort",
    tags: ["leisure", "longFlight", "longTrip"],
    notes: "Something to enjoy in transit and downtime",
  },
  {
    name: "Travel pillow",
    category: "Comfort",
    tags: ["leisure", "flight"],
    notes: "More restful travel days",
  },
  {
    name: "Quick-dry travel towel",
    category: "Comfort",
    tags: ["humid", "hiking", "longTrip"],
    notes: "Dries fast in humid conditions",
  },

  /* ------------------------------------------------------------------ */
  /* Miscellaneous                                                      */
  /* ------------------------------------------------------------------ */
  {
    name: "Day bag",
    category: "Miscellaneous",
    tags: ["all", "leisure"],
    notes: "Essentials for outings from your base",
  },
  {
    name: "Compact travel umbrella",
    category: "Miscellaneous",
    tags: ["rain", "city"],
    notes: "Packable cover for showers",
  },
  {
    name: "Foldable tote bag",
    category: "Miscellaneous",
    tags: ["city", "leisure", "longTrip"],
    notes: "For groceries, markets, or souvenirs",
  },
  {
    name: "Beach bag / tote",
    category: "Miscellaneous",
    tags: ["beach"],
    notes: "Carries towels, water, and sunscreen",
  },
  {
    name: "Notepad & pen",
    category: "Miscellaneous",
    tags: ["business"],
    notes: "Reliable backup if devices fail",
  },
  {
    name: "Portable garment steamer",
    category: "Miscellaneous",
    tags: ["business"],
    notes: "Optional — a compact steamer keeps suits crisp",
  },
  {
    name: "Breath mints",
    category: "Miscellaneous",
    tags: ["business"],
    notes: "Handy before meetings",
  },
  {
    name: "Ski helmet",
    category: "Miscellaneous",
    tags: ["ski"],
    notes: "Or confirm a rental at the resort",
  },
  {
    name: "Ski goggles",
    category: "Miscellaneous",
    tags: ["ski", "snow"],
    notes: "Anti-fog lens suited to the light conditions",
  },
  {
    name: "Waterproof gear bag",
    category: "Miscellaneous",
    tags: ["ski", "snow", "rain"],
    notes: "Corrals wet boots and gloves",
  },
  {
    name: "Daypack (20–30L)",
    category: "Miscellaneous",
    tags: ["hiking", "city"],
    notes: "Carries water, layers, and snacks",
  },
  {
    name: "Trekking poles",
    category: "Miscellaneous",
    tags: ["hiking"],
    notes: "Optional — ease the load on knees and descents",
  },
  {
    name: "Multi-tool",
    category: "Miscellaneous",
    tags: ["hiking"],
    notes: "Knife, scissors, and repairs in one",
  },
  {
    name: "Map & compass",
    category: "Miscellaneous",
    tags: ["hiking"],
    notes: "Backup navigation if your phone dies",
  },
  {
    name: "Laundry soap sheets",
    category: "Miscellaneous",
    tags: ["longTrip"],
    notes: "Wash a few items mid-trip to pack lighter",
  },
  {
    name: "Packing cubes",
    category: "Miscellaneous",
    tags: ["longTrip"],
    notes: "Keep a longer trip's clothes organized",
  },
  {
    name: "Reusable shopping bag",
    category: "Miscellaneous",
    tags: ["longTrip"],
    notes: "Handy for groceries and laundry runs",
  },
  {
    name: "Sewing kit",
    category: "Miscellaneous",
    tags: ["longTrip"],
    notes: "Quick fixes for buttons and small tears",
  },
  {
    name: "Travel laundry kit",
    category: "Miscellaneous",
    tags: ["leisure", "longTrip"],
    notes: "Sink-wash soap and a few clips",
  },
];

/** Total catalog size (for sanity checks / docs). */
export const PACKING_ITEMS_COUNT = PACKING_ITEMS.length;
