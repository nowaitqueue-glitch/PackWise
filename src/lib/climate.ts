/** Daily weather row compatible with {@link DailyForecast} in weather.ts. */
export type ClimateDailyForecast = {
  date: string;
  condition: string;
  highTemp: number;
  lowTemp: number;
  rainChance: number;
  icon: string;
  projected: true;
  source: "climate";
  message: string;
};

const CLIMATE_CONDITION_EMOJI: Record<string, string> = {
  Seasonal: "🌍",
  "Mild climate": "🌤️",
};

/** Monthly climate averages for a destination (month index 0 = January). */
export type ClimateMonth = {
  tempMax: number;
  tempMin: number;
  /** 0–100 percent. */
  rainChance: number;
  condition: string;
};

export type ClimateDayEstimate = {
  tempMax: number;
  tempMin: number;
  rainChance: number;
  condition: string;
};

const GLOBAL_DEFAULT: ClimateDayEstimate = {
  tempMax: 22,
  tempMin: 14,
  rainChance: 40,
  condition: "Mild climate",
};

/** Jan–Dec monthly averages for popular destinations (°C, rain %). */
const DESTINATION_CLIMATE: Record<string, ClimateMonth[]> = {
  tokyo: [
    { tempMax: 10, tempMin: 2, rainChance: 20, condition: "Seasonal" },
    { tempMax: 11, tempMin: 3, rainChance: 25, condition: "Seasonal" },
    { tempMax: 14, tempMin: 6, rainChance: 35, condition: "Seasonal" },
    { tempMax: 19, tempMin: 10, rainChance: 40, condition: "Seasonal" },
    { tempMax: 23, tempMin: 15, rainChance: 45, condition: "Seasonal" },
    { tempMax: 26, tempMin: 19, rainChance: 50, condition: "Seasonal" },
    { tempMax: 30, tempMin: 23, rainChance: 40, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 35, condition: "Seasonal" },
    { tempMax: 27, tempMin: 20, rainChance: 45, condition: "Seasonal" },
    { tempMax: 22, tempMin: 14, rainChance: 40, condition: "Seasonal" },
    { tempMax: 17, tempMin: 9, rainChance: 30, condition: "Seasonal" },
    { tempMax: 12, tempMin: 4, rainChance: 20, condition: "Seasonal" },
  ],
  paris: [
    { tempMax: 7, tempMin: 2, rainChance: 50, condition: "Seasonal" },
    { tempMax: 9, tempMin: 3, rainChance: 45, condition: "Seasonal" },
    { tempMax: 13, tempMin: 5, rainChance: 45, condition: "Seasonal" },
    { tempMax: 16, tempMin: 7, rainChance: 50, condition: "Seasonal" },
    { tempMax: 20, tempMin: 11, rainChance: 50, condition: "Seasonal" },
    { tempMax: 23, tempMin: 14, rainChance: 45, condition: "Seasonal" },
    { tempMax: 26, tempMin: 16, rainChance: 40, condition: "Seasonal" },
    { tempMax: 26, tempMin: 16, rainChance: 40, condition: "Seasonal" },
    { tempMax: 22, tempMin: 12, rainChance: 45, condition: "Seasonal" },
    { tempMax: 16, tempMin: 9, rainChance: 50, condition: "Seasonal" },
    { tempMax: 11, tempMin: 6, rainChance: 55, condition: "Seasonal" },
    { tempMax: 8, tempMin: 3, rainChance: 55, condition: "Seasonal" },
  ],
  "new york": [
    { tempMax: 4, tempMin: -3, rainChance: 45, condition: "Seasonal" },
    { tempMax: 6, tempMin: -2, rainChance: 40, condition: "Seasonal" },
    { tempMax: 11, tempMin: 2, rainChance: 45, condition: "Seasonal" },
    { tempMax: 17, tempMin: 7, rainChance: 45, condition: "Seasonal" },
    { tempMax: 22, tempMin: 12, rainChance: 45, condition: "Seasonal" },
    { tempMax: 27, tempMin: 17, rainChance: 40, condition: "Seasonal" },
    { tempMax: 30, tempMin: 20, rainChance: 40, condition: "Seasonal" },
    { tempMax: 29, tempMin: 20, rainChance: 40, condition: "Seasonal" },
    { tempMax: 25, tempMin: 16, rainChance: 40, condition: "Seasonal" },
    { tempMax: 18, tempMin: 10, rainChance: 40, condition: "Seasonal" },
    { tempMax: 12, tempMin: 5, rainChance: 45, condition: "Seasonal" },
    { tempMax: 6, tempMin: 0, rainChance: 45, condition: "Seasonal" },
  ],
  manila: [
    { tempMax: 30, tempMin: 22, rainChance: 15, condition: "Seasonal" },
    { tempMax: 31, tempMin: 22, rainChance: 10, condition: "Seasonal" },
    { tempMax: 32, tempMin: 23, rainChance: 15, condition: "Seasonal" },
    { tempMax: 34, tempMin: 24, rainChance: 20, condition: "Seasonal" },
    { tempMax: 33, tempMin: 25, rainChance: 45, condition: "Seasonal" },
    { tempMax: 32, tempMin: 25, rainChance: 55, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 70, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 75, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 70, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 60, condition: "Seasonal" },
    { tempMax: 31, tempMin: 23, rainChance: 45, condition: "Seasonal" },
    { tempMax: 30, tempMin: 22, rainChance: 30, condition: "Seasonal" },
  ],
  berlin: [
    { tempMax: 3, tempMin: -2, rainChance: 50, condition: "Seasonal" },
    { tempMax: 5, tempMin: -1, rainChance: 45, condition: "Seasonal" },
    { tempMax: 10, tempMin: 2, rainChance: 45, condition: "Seasonal" },
    { tempMax: 15, tempMin: 5, rainChance: 45, condition: "Seasonal" },
    { tempMax: 20, tempMin: 10, rainChance: 50, condition: "Seasonal" },
    { tempMax: 23, tempMin: 13, rainChance: 50, condition: "Seasonal" },
    { tempMax: 25, tempMin: 15, rainChance: 45, condition: "Seasonal" },
    { tempMax: 25, tempMin: 15, rainChance: 45, condition: "Seasonal" },
    { tempMax: 20, tempMin: 11, rainChance: 45, condition: "Seasonal" },
    { tempMax: 14, tempMin: 7, rainChance: 45, condition: "Seasonal" },
    { tempMax: 8, tempMin: 3, rainChance: 50, condition: "Seasonal" },
    { tempMax: 4, tempMin: 0, rainChance: 50, condition: "Seasonal" },
  ],
  london: [
    { tempMax: 8, tempMin: 3, rainChance: 55, condition: "Seasonal" },
    { tempMax: 9, tempMin: 3, rainChance: 50, condition: "Seasonal" },
    { tempMax: 12, tempMin: 5, rainChance: 45, condition: "Seasonal" },
    { tempMax: 15, tempMin: 7, rainChance: 45, condition: "Seasonal" },
    { tempMax: 18, tempMin: 10, rainChance: 45, condition: "Seasonal" },
    { tempMax: 21, tempMin: 13, rainChance: 45, condition: "Seasonal" },
    { tempMax: 23, tempMin: 15, rainChance: 40, condition: "Seasonal" },
    { tempMax: 23, tempMin: 15, rainChance: 45, condition: "Seasonal" },
    { tempMax: 20, tempMin: 13, rainChance: 45, condition: "Seasonal" },
    { tempMax: 15, tempMin: 9, rainChance: 50, condition: "Seasonal" },
    { tempMax: 11, tempMin: 6, rainChance: 55, condition: "Seasonal" },
    { tempMax: 8, tempMin: 3, rainChance: 55, condition: "Seasonal" },
  ],
  sydney: [
    { tempMax: 27, tempMin: 19, rainChance: 40, condition: "Seasonal" },
    { tempMax: 27, tempMin: 19, rainChance: 45, condition: "Seasonal" },
    { tempMax: 26, tempMin: 18, rainChance: 45, condition: "Seasonal" },
    { tempMax: 23, tempMin: 15, rainChance: 45, condition: "Seasonal" },
    { tempMax: 20, tempMin: 12, rainChance: 40, condition: "Seasonal" },
    { tempMax: 17, tempMin: 9, rainChance: 45, condition: "Seasonal" },
    { tempMax: 16, tempMin: 8, rainChance: 40, condition: "Seasonal" },
    { tempMax: 18, tempMin: 9, rainChance: 35, condition: "Seasonal" },
    { tempMax: 20, tempMin: 11, rainChance: 35, condition: "Seasonal" },
    { tempMax: 22, tempMin: 13, rainChance: 40, condition: "Seasonal" },
    { tempMax: 24, tempMin: 16, rainChance: 45, condition: "Seasonal" },
    { tempMax: 26, tempMin: 18, rainChance: 40, condition: "Seasonal" },
  ],
  dubai: [
    { tempMax: 24, tempMin: 14, rainChance: 15, condition: "Seasonal" },
    { tempMax: 25, tempMin: 15, rainChance: 15, condition: "Seasonal" },
    { tempMax: 28, tempMin: 18, rainChance: 15, condition: "Seasonal" },
    { tempMax: 33, tempMin: 22, rainChance: 10, condition: "Seasonal" },
    { tempMax: 38, tempMin: 26, rainChance: 5, condition: "Seasonal" },
    { tempMax: 40, tempMin: 28, rainChance: 5, condition: "Seasonal" },
    { tempMax: 41, tempMin: 30, rainChance: 5, condition: "Seasonal" },
    { tempMax: 41, tempMin: 30, rainChance: 5, condition: "Seasonal" },
    { tempMax: 38, tempMin: 27, rainChance: 5, condition: "Seasonal" },
    { tempMax: 35, tempMin: 23, rainChance: 5, condition: "Seasonal" },
    { tempMax: 30, tempMin: 19, rainChance: 10, condition: "Seasonal" },
    { tempMax: 26, tempMin: 16, rainChance: 15, condition: "Seasonal" },
  ],
  bangkok: [
    { tempMax: 32, tempMin: 21, rainChance: 10, condition: "Seasonal" },
    { tempMax: 33, tempMin: 23, rainChance: 15, condition: "Seasonal" },
    { tempMax: 34, tempMin: 25, rainChance: 25, condition: "Seasonal" },
    { tempMax: 35, tempMin: 26, rainChance: 35, condition: "Seasonal" },
    { tempMax: 34, tempMin: 26, rainChance: 55, condition: "Seasonal" },
    { tempMax: 33, tempMin: 25, rainChance: 60, condition: "Seasonal" },
    { tempMax: 33, tempMin: 25, rainChance: 65, condition: "Seasonal" },
    { tempMax: 32, tempMin: 25, rainChance: 70, condition: "Seasonal" },
    { tempMax: 32, tempMin: 24, rainChance: 75, condition: "Seasonal" },
    { tempMax: 32, tempMin: 24, rainChance: 65, condition: "Seasonal" },
    { tempMax: 31, tempMin: 23, rainChance: 40, condition: "Seasonal" },
    { tempMax: 31, tempMin: 21, rainChance: 15, condition: "Seasonal" },
  ],
  rome: [
    { tempMax: 12, tempMin: 4, rainChance: 45, condition: "Seasonal" },
    { tempMax: 14, tempMin: 5, rainChance: 40, condition: "Seasonal" },
    { tempMax: 17, tempMin: 7, rainChance: 40, condition: "Seasonal" },
    { tempMax: 20, tempMin: 10, rainChance: 40, condition: "Seasonal" },
    { tempMax: 24, tempMin: 13, rainChance: 35, condition: "Seasonal" },
    { tempMax: 28, tempMin: 17, rainChance: 25, condition: "Seasonal" },
    { tempMax: 31, tempMin: 19, rainChance: 15, condition: "Seasonal" },
    { tempMax: 31, tempMin: 19, rainChance: 20, condition: "Seasonal" },
    { tempMax: 27, tempMin: 16, rainChance: 35, condition: "Seasonal" },
    { tempMax: 22, tempMin: 12, rainChance: 45, condition: "Seasonal" },
    { tempMax: 16, tempMin: 8, rainChance: 50, condition: "Seasonal" },
    { tempMax: 13, tempMin: 5, rainChance: 50, condition: "Seasonal" },
  ],
  barcelona: [
    { tempMax: 14, tempMin: 8, rainChance: 35, condition: "Seasonal" },
    { tempMax: 15, tempMin: 8, rainChance: 30, condition: "Seasonal" },
    { tempMax: 17, tempMin: 10, rainChance: 35, condition: "Seasonal" },
    { tempMax: 19, tempMin: 12, rainChance: 40, condition: "Seasonal" },
    { tempMax: 22, tempMin: 15, rainChance: 40, condition: "Seasonal" },
    { tempMax: 26, tempMin: 19, rainChance: 25, condition: "Seasonal" },
    { tempMax: 29, tempMin: 22, rainChance: 15, condition: "Seasonal" },
    { tempMax: 29, tempMin: 22, rainChance: 20, condition: "Seasonal" },
    { tempMax: 26, tempMin: 19, rainChance: 35, condition: "Seasonal" },
    { tempMax: 22, tempMin: 15, rainChance: 40, condition: "Seasonal" },
    { tempMax: 17, tempMin: 11, rainChance: 45, condition: "Seasonal" },
    { tempMax: 14, tempMin: 8, rainChance: 40, condition: "Seasonal" },
  ],
  amsterdam: [
    { tempMax: 6, tempMin: 1, rainChance: 55, condition: "Seasonal" },
    { tempMax: 7, tempMin: 1, rainChance: 50, condition: "Seasonal" },
    { tempMax: 10, tempMin: 3, rainChance: 45, condition: "Seasonal" },
    { tempMax: 13, tempMin: 5, rainChance: 45, condition: "Seasonal" },
    { tempMax: 17, tempMin: 9, rainChance: 45, condition: "Seasonal" },
    { tempMax: 20, tempMin: 12, rainChance: 50, condition: "Seasonal" },
    { tempMax: 22, tempMin: 14, rainChance: 50, condition: "Seasonal" },
    { tempMax: 22, tempMin: 14, rainChance: 50, condition: "Seasonal" },
    { tempMax: 19, tempMin: 11, rainChance: 50, condition: "Seasonal" },
    { tempMax: 14, tempMin: 8, rainChance: 55, condition: "Seasonal" },
    { tempMax: 9, tempMin: 5, rainChance: 55, condition: "Seasonal" },
    { tempMax: 6, tempMin: 2, rainChance: 55, condition: "Seasonal" },
  ],
  singapore: [
    { tempMax: 30, tempMin: 24, rainChance: 60, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 50, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 55, condition: "Seasonal" },
    { tempMax: 32, tempMin: 25, rainChance: 55, condition: "Seasonal" },
    { tempMax: 32, tempMin: 25, rainChance: 55, condition: "Seasonal" },
    { tempMax: 31, tempMin: 25, rainChance: 50, condition: "Seasonal" },
    { tempMax: 31, tempMin: 25, rainChance: 50, condition: "Seasonal" },
    { tempMax: 31, tempMin: 25, rainChance: 55, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 55, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 60, condition: "Seasonal" },
    { tempMax: 30, tempMin: 24, rainChance: 65, condition: "Seasonal" },
    { tempMax: 30, tempMin: 24, rainChance: 70, condition: "Seasonal" },
  ],
  "hong kong": [
    { tempMax: 18, tempMin: 14, rainChance: 25, condition: "Seasonal" },
    { tempMax: 18, tempMin: 14, rainChance: 30, condition: "Seasonal" },
    { tempMax: 21, tempMin: 17, rainChance: 45, condition: "Seasonal" },
    { tempMax: 25, tempMin: 21, rainChance: 55, condition: "Seasonal" },
    { tempMax: 28, tempMin: 24, rainChance: 60, condition: "Seasonal" },
    { tempMax: 30, tempMin: 26, rainChance: 65, condition: "Seasonal" },
    { tempMax: 31, tempMin: 27, rainChance: 60, condition: "Seasonal" },
    { tempMax: 31, tempMin: 27, rainChance: 65, condition: "Seasonal" },
    { tempMax: 30, tempMin: 26, rainChance: 60, condition: "Seasonal" },
    { tempMax: 28, tempMin: 24, rainChance: 45, condition: "Seasonal" },
    { tempMax: 24, tempMin: 20, rainChance: 30, condition: "Seasonal" },
    { tempMax: 20, tempMin: 15, rainChance: 25, condition: "Seasonal" },
  ],
  "los angeles": [
    { tempMax: 20, tempMin: 10, rainChance: 25, condition: "Seasonal" },
    { tempMax: 21, tempMin: 11, rainChance: 25, condition: "Seasonal" },
    { tempMax: 22, tempMin: 12, rainChance: 20, condition: "Seasonal" },
    { tempMax: 23, tempMin: 13, rainChance: 15, condition: "Seasonal" },
    { tempMax: 24, tempMin: 15, rainChance: 10, condition: "Seasonal" },
    { tempMax: 26, tempMin: 17, rainChance: 5, condition: "Seasonal" },
    { tempMax: 29, tempMin: 19, rainChance: 5, condition: "Seasonal" },
    { tempMax: 29, tempMin: 19, rainChance: 5, condition: "Seasonal" },
    { tempMax: 28, tempMin: 18, rainChance: 5, condition: "Seasonal" },
    { tempMax: 25, tempMin: 15, rainChance: 10, condition: "Seasonal" },
    { tempMax: 22, tempMin: 12, rainChance: 20, condition: "Seasonal" },
    { tempMax: 19, tempMin: 10, rainChance: 25, condition: "Seasonal" },
  ],
  miami: [
    { tempMax: 24, tempMin: 16, rainChance: 30, condition: "Seasonal" },
    { tempMax: 25, tempMin: 17, rainChance: 30, condition: "Seasonal" },
    { tempMax: 26, tempMin: 18, rainChance: 30, condition: "Seasonal" },
    { tempMax: 28, tempMin: 20, rainChance: 25, condition: "Seasonal" },
    { tempMax: 30, tempMin: 22, rainChance: 35, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 50, condition: "Seasonal" },
    { tempMax: 32, tempMin: 25, rainChance: 45, condition: "Seasonal" },
    { tempMax: 32, tempMin: 25, rainChance: 50, condition: "Seasonal" },
    { tempMax: 31, tempMin: 24, rainChance: 55, condition: "Seasonal" },
    { tempMax: 29, tempMin: 22, rainChance: 45, condition: "Seasonal" },
    { tempMax: 27, tempMin: 20, rainChance: 35, condition: "Seasonal" },
    { tempMax: 25, tempMin: 17, rainChance: 30, condition: "Seasonal" },
  ],
  toronto: [
    { tempMax: -1, tempMin: -8, rainChance: 45, condition: "Seasonal" },
    { tempMax: 0, tempMin: -7, rainChance: 40, condition: "Seasonal" },
    { tempMax: 5, tempMin: -3, rainChance: 40, condition: "Seasonal" },
    { tempMax: 12, tempMin: 3, rainChance: 45, condition: "Seasonal" },
    { tempMax: 19, tempMin: 9, rainChance: 45, condition: "Seasonal" },
    { tempMax: 24, tempMin: 14, rainChance: 45, condition: "Seasonal" },
    { tempMax: 27, tempMin: 17, rainChance: 40, condition: "Seasonal" },
    { tempMax: 26, tempMin: 16, rainChance: 40, condition: "Seasonal" },
    { tempMax: 22, tempMin: 12, rainChance: 40, condition: "Seasonal" },
    { tempMax: 15, tempMin: 6, rainChance: 45, condition: "Seasonal" },
    { tempMax: 8, tempMin: 1, rainChance: 50, condition: "Seasonal" },
    { tempMax: 1, tempMin: -5, rainChance: 50, condition: "Seasonal" },
  ],
  seoul: [
    { tempMax: 2, tempMin: -6, rainChance: 25, condition: "Seasonal" },
    { tempMax: 5, tempMin: -4, rainChance: 25, condition: "Seasonal" },
    { tempMax: 11, tempMin: 1, rainChance: 30, condition: "Seasonal" },
    { tempMax: 18, tempMin: 7, rainChance: 35, condition: "Seasonal" },
    { tempMax: 23, tempMin: 12, rainChance: 40, condition: "Seasonal" },
    { tempMax: 27, tempMin: 17, rainChance: 45, condition: "Seasonal" },
    { tempMax: 29, tempMin: 21, rainChance: 50, condition: "Seasonal" },
    { tempMax: 30, tempMin: 22, rainChance: 45, condition: "Seasonal" },
    { tempMax: 26, tempMin: 17, rainChance: 35, condition: "Seasonal" },
    { tempMax: 20, tempMin: 10, rainChance: 30, condition: "Seasonal" },
    { tempMax: 11, tempMin: 3, rainChance: 30, condition: "Seasonal" },
    { tempMax: 4, tempMin: -3, rainChance: 25, condition: "Seasonal" },
  ],
  mumbai: [
    { tempMax: 31, tempMin: 19, rainChance: 5, condition: "Seasonal" },
    { tempMax: 31, tempMin: 20, rainChance: 5, condition: "Seasonal" },
    { tempMax: 32, tempMin: 22, rainChance: 5, condition: "Seasonal" },
    { tempMax: 33, tempMin: 24, rainChance: 5, condition: "Seasonal" },
    { tempMax: 33, tempMin: 27, rainChance: 20, condition: "Seasonal" },
    { tempMax: 31, tempMin: 26, rainChance: 55, condition: "Seasonal" },
    { tempMax: 29, tempMin: 25, rainChance: 70, condition: "Seasonal" },
    { tempMax: 29, tempMin: 25, rainChance: 70, condition: "Seasonal" },
    { tempMax: 30, tempMin: 25, rainChance: 55, condition: "Seasonal" },
    { tempMax: 33, tempMin: 24, rainChance: 15, condition: "Seasonal" },
    { tempMax: 33, tempMin: 22, rainChance: 10, condition: "Seasonal" },
    { tempMax: 32, tempMin: 20, rainChance: 5, condition: "Seasonal" },
  ],
  cairo: [
    { tempMax: 19, tempMin: 9, rainChance: 10, condition: "Seasonal" },
    { tempMax: 21, tempMin: 10, rainChance: 10, condition: "Seasonal" },
    { tempMax: 24, tempMin: 12, rainChance: 10, condition: "Seasonal" },
    { tempMax: 28, tempMin: 15, rainChance: 5, condition: "Seasonal" },
    { tempMax: 32, tempMin: 18, rainChance: 5, condition: "Seasonal" },
    { tempMax: 35, tempMin: 21, rainChance: 5, condition: "Seasonal" },
    { tempMax: 36, tempMin: 23, rainChance: 5, condition: "Seasonal" },
    { tempMax: 36, tempMin: 23, rainChance: 5, condition: "Seasonal" },
    { tempMax: 34, tempMin: 22, rainChance: 5, condition: "Seasonal" },
    { tempMax: 30, tempMin: 19, rainChance: 5, condition: "Seasonal" },
    { tempMax: 25, tempMin: 15, rainChance: 10, condition: "Seasonal" },
    { tempMax: 20, tempMin: 11, rainChance: 10, condition: "Seasonal" },
  ],
  istanbul: [
    { tempMax: 8, tempMin: 3, rainChance: 45, condition: "Seasonal" },
    { tempMax: 9, tempMin: 3, rainChance: 40, condition: "Seasonal" },
    { tempMax: 12, tempMin: 5, rainChance: 40, condition: "Seasonal" },
    { tempMax: 17, tempMin: 9, rainChance: 40, condition: "Seasonal" },
    { tempMax: 22, tempMin: 13, rainChance: 35, condition: "Seasonal" },
    { tempMax: 26, tempMin: 17, rainChance: 30, condition: "Seasonal" },
    { tempMax: 28, tempMin: 19, rainChance: 25, condition: "Seasonal" },
    { tempMax: 28, tempMin: 19, rainChance: 25, condition: "Seasonal" },
    { tempMax: 25, tempMin: 16, rainChance: 30, condition: "Seasonal" },
    { tempMax: 20, tempMin: 12, rainChance: 40, condition: "Seasonal" },
    { tempMax: 14, tempMin: 8, rainChance: 45, condition: "Seasonal" },
    { tempMax: 10, tempMin: 5, rainChance: 50, condition: "Seasonal" },
  ],
  "rio de janeiro": [
    { tempMax: 30, tempMin: 23, rainChance: 55, condition: "Seasonal" },
    { tempMax: 30, tempMin: 23, rainChance: 50, condition: "Seasonal" },
    { tempMax: 29, tempMin: 22, rainChance: 45, condition: "Seasonal" },
    { tempMax: 28, tempMin: 21, rainChance: 45, condition: "Seasonal" },
    { tempMax: 26, tempMin: 19, rainChance: 40, condition: "Seasonal" },
    { tempMax: 25, tempMin: 18, rainChance: 35, condition: "Seasonal" },
    { tempMax: 25, tempMin: 17, rainChance: 35, condition: "Seasonal" },
    { tempMax: 26, tempMin: 18, rainChance: 35, condition: "Seasonal" },
    { tempMax: 27, tempMin: 19, rainChance: 40, condition: "Seasonal" },
    { tempMax: 28, tempMin: 20, rainChance: 45, condition: "Seasonal" },
    { tempMax: 29, tempMin: 21, rainChance: 50, condition: "Seasonal" },
    { tempMax: 30, tempMin: 22, rainChance: 55, condition: "Seasonal" },
  ],
  "mexico city": [
    { tempMax: 21, tempMin: 6, rainChance: 15, condition: "Seasonal" },
    { tempMax: 23, tempMin: 7, rainChance: 10, condition: "Seasonal" },
    { tempMax: 25, tempMin: 9, rainChance: 15, condition: "Seasonal" },
    { tempMax: 27, tempMin: 11, rainChance: 25, condition: "Seasonal" },
    { tempMax: 26, tempMin: 12, rainChance: 45, condition: "Seasonal" },
    { tempMax: 25, tempMin: 12, rainChance: 55, condition: "Seasonal" },
    { tempMax: 24, tempMin: 12, rainChance: 55, condition: "Seasonal" },
    { tempMax: 24, tempMin: 12, rainChance: 55, condition: "Seasonal" },
    { tempMax: 23, tempMin: 11, rainChance: 50, condition: "Seasonal" },
    { tempMax: 22, tempMin: 10, rainChance: 35, condition: "Seasonal" },
    { tempMax: 21, tempMin: 8, rainChance: 20, condition: "Seasonal" },
    { tempMax: 21, tempMin: 6, rainChance: 15, condition: "Seasonal" },
  ],
  vancouver: [
    { tempMax: 7, tempMin: 2, rainChance: 55, condition: "Seasonal" },
    { tempMax: 9, tempMin: 3, rainChance: 50, condition: "Seasonal" },
    { tempMax: 11, tempMin: 4, rainChance: 50, condition: "Seasonal" },
    { tempMax: 14, tempMin: 6, rainChance: 50, condition: "Seasonal" },
    { tempMax: 18, tempMin: 9, rainChance: 45, condition: "Seasonal" },
    { tempMax: 21, tempMin: 12, rainChance: 40, condition: "Seasonal" },
    { tempMax: 24, tempMin: 14, rainChance: 30, condition: "Seasonal" },
    { tempMax: 24, tempMin: 14, rainChance: 30, condition: "Seasonal" },
    { tempMax: 20, tempMin: 11, rainChance: 40, condition: "Seasonal" },
    { tempMax: 14, tempMin: 7, rainChance: 55, condition: "Seasonal" },
    { tempMax: 9, tempMin: 4, rainChance: 60, condition: "Seasonal" },
    { tempMax: 6, tempMin: 2, rainChance: 60, condition: "Seasonal" },
  ],
  "san francisco": [
    { tempMax: 14, tempMin: 8, rainChance: 45, condition: "Seasonal" },
    { tempMax: 16, tempMin: 9, rainChance: 40, condition: "Seasonal" },
    { tempMax: 17, tempMin: 10, rainChance: 40, condition: "Seasonal" },
    { tempMax: 18, tempMin: 10, rainChance: 35, condition: "Seasonal" },
    { tempMax: 19, tempMin: 11, rainChance: 25, condition: "Seasonal" },
    { tempMax: 20, tempMin: 12, rainChance: 15, condition: "Seasonal" },
    { tempMax: 21, tempMin: 13, rainChance: 5, condition: "Seasonal" },
    { tempMax: 22, tempMin: 13, rainChance: 5, condition: "Seasonal" },
    { tempMax: 23, tempMin: 13, rainChance: 5, condition: "Seasonal" },
    { tempMax: 21, tempMin: 12, rainChance: 15, condition: "Seasonal" },
    { tempMax: 17, tempMin: 10, rainChance: 35, condition: "Seasonal" },
    { tempMax: 14, tempMin: 8, rainChance: 45, condition: "Seasonal" },
  ],
};

const DESTINATION_ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  ph: "manila",
  hk: "hong kong",
  la: "los angeles",
  sf: "san francisco",
  "são paulo": "rio de janeiro",
  "sao paulo": "rio de janeiro",
  münchen: "berlin",
  munich: "berlin",
  köln: "berlin",
  koeln: "berlin",
  madrid: "barcelona",
  lisbon: "barcelona",
  lisboa: "barcelona",
};

function normalizeDestinationKey(destination: string): string {
  const trimmed = destination.trim().toLowerCase();
  const cityPart = trimmed.includes(",")
    ? trimmed.split(",")[0]?.trim() ?? trimmed
    : trimmed;
  return DESTINATION_ALIASES[cityPart] ?? cityPart;
}

function monthIndexFromISO(date: string): number {
  return Number(date.slice(5, 7)) - 1;
}

function rainChance01(percent: number): number {
  return Math.round(Math.min(1, Math.max(0, percent / 100)) * 100) / 100;
}

/**
 * Monthly climate averages for a destination.
 * @param month Calendar month 1–12 (January = 1).
 */
export function getClimateFallback(
  destination: string,
  month: number
): ClimateDayEstimate {
  const monthIndex = Math.min(11, Math.max(0, month - 1));
  const key = normalizeDestinationKey(destination);
  const table = DESTINATION_CLIMATE[key];
  if (table?.[monthIndex]) {
    const row = table[monthIndex];
    return {
      tempMax: row.tempMax,
      tempMin: row.tempMin,
      rainChance: row.rainChance,
      condition: row.condition,
    };
  }
  return GLOBAL_DEFAULT;
}

function enumerateTripDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    const date = new Date(`${cursor}T00:00:00`);
    date.setDate(date.getDate() + 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    cursor = `${y}-${m}-${d}`;
  }
  return dates;
}

function climateEmoji(condition: string): string {
  return CLIMATE_CONDITION_EMOJI[condition] ?? "🌤️";
}

function climateDayToForecast(
  date: string,
  estimate: ClimateDayEstimate
): ClimateDailyForecast {
  return {
    date,
    condition: estimate.condition,
    highTemp: estimate.tempMax,
    lowTemp: estimate.tempMin,
    rainChance: rainChance01(estimate.rainChance),
    icon: climateEmoji(estimate.condition),
    projected: true,
    source: "climate",
    message: "Seasonal climate average",
  };
}

/** Daily climate estimates for an entire trip date range. */
export function getClimateFallbackDays(
  destination: string,
  startDate: string,
  endDate: string
): ClimateDailyForecast[] {
  return enumerateTripDates(startDate, endDate).map((date) => {
    const month = monthIndexFromISO(date) + 1;
    return climateDayToForecast(date, getClimateFallback(destination, month));
  });
}
