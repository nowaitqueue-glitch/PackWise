/**
 * Detect missing or template placeholder secrets from .env.local.example.
 * Rejects empty values and common stubs (YOUR_KEY, your-*, YOUR_*).
 */
export function isPlaceholderSecret(value) {
  if (value == null) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (lower === "your_key" || lower === "your-key") return true;
  if (lower.startsWith("your_") || lower.startsWith("your-")) return true;
  if (lower === "changeme" || lower === "replace_me" || lower === "todo") {
    return true;
  }
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

/**
 * Exit with a clear error if a required env var is missing or a placeholder.
 */
export function requireEnv(name, value) {
  if (isPlaceholderSecret(value)) {
    console.error(
      `\n✖ Missing or placeholder ${name}. Set a real value in .env.local (see .env.local.example).`
    );
    process.exit(1);
  }
  return value.trim();
}
