export function composeDestination(
  city: string,
  countryCode: string | null | undefined
): string {
  const trimmedCity = city.trim();
  const code = countryCode?.trim().toUpperCase() ?? "";
  return code ? `${trimmedCity}, ${code}` : trimmedCity;
}

/**
 * Split a stored destination (`"Berlin, DE"` or `"Berlin"`) into form fields.
 * Uses the last comma so city names with commas still round-trip when the
 * trailing segment is a 2-letter ISO country code.
 */
export function parseDestinationParts(destination: string): {
  city: string;
  countryCode: string;
} {
  const raw = destination.trim();
  const commaIndex = raw.lastIndexOf(",");
  if (commaIndex === -1) {
    return { city: raw, countryCode: "" };
  }

  const city = raw.slice(0, commaIndex).trim();
  const countryCode = raw.slice(commaIndex + 1).trim().toUpperCase();
  if (countryCode.length === 2) {
    return { city: city || raw, countryCode };
  }

  return { city: raw, countryCode: "" };
}

export function validateCity(city: string): string | null {
  const trimmed = city.trim();
  if (!trimmed) {
    return "City is required.";
  }
  if (trimmed.length < 2) {
    return "City must be at least 2 characters.";
  }
  if (/\d/.test(trimmed)) {
    return "City cannot contain numbers.";
  }
  return null;
}
