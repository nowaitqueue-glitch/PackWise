import countriesData from "@/data/countries.json";

export type Country = {
  code: string;
  name: string;
};

/** Popular destinations shown first in the country combobox. */
export const POPULAR_COUNTRY_CODES = [
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
] as const;

export const COUNTRIES = countriesData as Country[];

const POPULAR_SET = new Set<string>(POPULAR_COUNTRY_CODES);

export const POPULAR_COUNTRIES = COUNTRIES.filter((c) =>
  POPULAR_SET.has(c.code)
);

export const OTHER_COUNTRIES = COUNTRIES.filter(
  (c) => !POPULAR_SET.has(c.code)
);

const CODE_SET = new Set(COUNTRIES.map((c) => c.code));

export function isValidCountryCode(code: string): boolean {
  return CODE_SET.has(code.toUpperCase());
}

export function getCountryName(code: string): string | undefined {
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper)?.name;
}
