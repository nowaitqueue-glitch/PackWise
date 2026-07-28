import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type GenerateContentResult,
  type GenerativeModel,
  type ModelParams,
  type Part,
  type SingleRequestOptions,
} from "@google/generative-ai";
import { hasRealSecret } from "@/lib/env";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 2000;

export type GenerateContentInput =
  | GenerateContentRequest
  | string
  | Array<string | Part>;

export type GenerateContentWithRetryOptions = {
  /** Total API call attempts (initial + retries). Default: 3. */
  maxAttempts?: number;
  requestOptions?: SingleRequestOptions;
};

/** Returns a real GEMINI_API_KEY, or null if missing/placeholder. */
export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return hasRealSecret(key) ? key : null;
}

/** Builds a GoogleGenerativeAI client from GEMINI_API_KEY (or an explicit key). */
export function getGeminiClient(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey ?? getGeminiApiKey();
  if (!key) {
    throw new Error(
      "Gemini API key is not configured. Set GEMINI_API_KEY in .env.local."
    );
  }
  return new GoogleGenerativeAI(key);
}

/** Model factory using getGeminiClient(). */
export function getGeminiModel(
  modelParams: ModelParams,
  apiKey?: string
): GenerativeModel {
  return getGeminiClient(apiKey).getGenerativeModel(modelParams);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRateLimitError(error: unknown): boolean {
  if (!isRecord(error)) return false;

  if (error.status === 429) return true;

  const response = error.response;
  if (isRecord(response) && response.status === 429) return true;

  const message = typeof error.message === "string" ? error.message : "";
  if (/\b429\b/.test(message)) return true;
  if (/rate.?limit|quota|resource.?exhausted/i.test(message)) return true;

  return false;
}

function headerValue(
  headers: unknown,
  name: string
): string | null {
  if (!headers) return null;

  const lower = name.toLowerCase();

  if (typeof (headers as Headers).get === "function") {
    const value = (headers as Headers).get(name) ?? (headers as Headers).get(lower);
    return value?.trim() ? value.trim() : null;
  }

  if (!isRecord(headers)) return null;

  for (const [key, raw] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
      return raw[0].trim();
    }
  }

  return null;
}

/**
 * Prefer Retry-After (seconds). Falls back to exponential backoff:
 * 2s, 4s, 8s for attempts 1→2, 2→3, 3→4.
 */
function getWaitMs(error: unknown, failedAttempt: number): number {
  const response = isRecord(error) ? error.response : undefined;
  const headers = isRecord(response) ? response.headers : undefined;
  const retryAfter = headerValue(headers, "retry-after");

  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.ceil(asSeconds * 1000);
    }
    const asDate = Date.parse(retryAfter);
    if (!Number.isNaN(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  return BASE_BACKOFF_MS * 2 ** (failedAttempt - 1);
}

/**
 * Wraps model.generateContent with 429 retry:
 * up to 3 attempts, Retry-After or exponential backoff (2s → 4s → 8s).
 */
export async function generateContentWithRetry(
  model: GenerativeModel,
  request: GenerateContentInput,
  options?: GenerateContentWithRetryOptions
): Promise<GenerateContentResult> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await model.generateContent(request, options?.requestOptions);
    } catch (error) {
      lastError = error;
      const canRetry = isRateLimitError(error) && attempt < maxAttempts;
      if (!canRetry) {
        throw error;
      }

      const waitMs = getWaitMs(error, attempt);
      console.warn(
        `[gemini] 429 rate limit on attempt ${attempt}/${maxAttempts}; retrying in ${waitMs}ms`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw lastError;
}
