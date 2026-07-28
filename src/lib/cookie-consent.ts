/** Cookie consent for analytics (client-side only). */

export const COOKIE_CONSENT_NAME = "packwise_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
export const COOKIE_CONSENT_EVENT = "packwise:cookie-consent";

export type CookieConsentValue = "accepted" | "declined";

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_CONSENT_NAME}=([^;]*)`)
  );
  const value = match?.[1];
  if (value === "accepted" || value === "declined") return value;
  return null;
}

export function setCookieConsent(value: CookieConsentValue): void {
  if (typeof document === "undefined") return;

  document.cookie = [
    `${COOKIE_CONSENT_NAME}=${value}`,
    "path=/",
    `max-age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ].join("; ");

  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === "accepted";
}
