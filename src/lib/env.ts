/**
 * Detect missing or template placeholder secrets from .env.local.example.
 * Rejects empty values and common stubs (YOUR_KEY, your-*, YOUR_*).
 */
export function isPlaceholderSecret(
  value: string | undefined | null
): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (lower === "your_key" || lower === "your-key") return true;
  if (lower.startsWith("your_") || lower.startsWith("your-")) return true;
  if (lower === "changeme" || lower === "replace_me" || lower === "todo") {
    return true;
  }
  // Template fragments embedded in example URLs / keys
  if (
    lower.includes("your-project-ref") ||
    lower.includes("your-anon-key") ||
    lower.includes("your_anon") ||
    lower.includes("your_openai") ||
    lower.includes("your-openai") ||
    lower.includes("your_gemini") ||
    lower.includes("your-gemini") ||
    lower.includes("your_openweather") ||
    lower.includes("your-openweather")
  ) {
    return true;
  }
  return false;
}

/** True when value is a non-empty, non-placeholder secret. */
export function hasRealSecret(
  value: string | undefined | null
): value is string {
  return !isPlaceholderSecret(value);
}
