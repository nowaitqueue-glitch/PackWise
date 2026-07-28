export const TRIP_TYPES = [
  "business",
  "leisure",
  "beach",
  "hiking",
  "skiing",
  "city break",
  "other",
] as const;

export type TripType = (typeof TRIP_TYPES)[number];

export function isTripType(value: string): value is TripType {
  return (TRIP_TYPES as readonly string[]).includes(value);
}

export function formatTripType(tripType: string): string {
  return tripType
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
