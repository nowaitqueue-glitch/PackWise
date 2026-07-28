/** Normalize DB / form trip_type values to a stable key. */
function normalizeTripTypeKey(type: string): string {
  const key = type.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (key === "ski") return "skiing";
  if (key === "citybreak") return "city_break";

  return key;
}

/**
 * Tailwind gradient classes for trip backgrounds (legacy).
 * Trip detail / cards now use getTripSceneBackground() image scenes;
 * keep this for any remaining gradient consumers.
 */
export function getBackgroundClass(type: string): string {
  switch (normalizeTripTypeKey(type)) {
    case "beach":
      return "bg-gradient-to-br from-orange-400 via-pink-400 to-yellow-300";
    case "business":
      return "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-700";
    case "skiing":
      return "bg-gradient-to-br from-sky-100 via-cyan-200 to-blue-300";
    case "hiking":
      return "bg-gradient-to-br from-green-800 via-emerald-700 to-amber-900";
    case "city_break":
      return "bg-gradient-to-br from-purple-800 via-indigo-900 to-slate-900";
    case "leisure":
      return "bg-gradient-to-br from-teal-200 via-sky-200 to-amber-100";
    case "other":
    default:
      return "bg-gradient-to-br from-gray-200 via-slate-100 to-white";
  }
}
