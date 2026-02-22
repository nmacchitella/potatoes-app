/**
 * Auth token storage utilities
 *
 * Tokens are stored in both localStorage and cookies:
 * - localStorage: Used for client-side API requests (acceptable for SPAs since
 *   XSS is the primary threat vector regardless of storage mechanism, and our
 *   CSP headers mitigate this risk).
 * - Cookies: Used by Next.js middleware for server-side auth checks.
 *   Cookies are set with Secure and SameSite=Lax flags.
 */

import { AUTH_CONFIG } from './constants';

const {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  REFRESH_TOKEN_MAX_AGE_SECONDS: REFRESH_TOKEN_MAX_AGE,
} = AUTH_CONFIG;

const TOKEN_EXPIRY_KEY = 'token_expires_at';

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

/**
 * Store access token with expiry time
 * @param token - The access token
 * @param expiresIn - Seconds until token expires
 */
export function setAccessToken(token: string, expiresIn?: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);

  // Store expiry time if provided
  if (expiresIn) {
    const expiresAt = Date.now() + (expiresIn * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
    // Set cookie with actual expiry
    setCookie(ACCESS_TOKEN_KEY, token, expiresIn);
  } else {
    // Fallback to 15 minutes if not provided
    setCookie(ACCESS_TOKEN_KEY, token, 15 * 60);
  }
}

export function setRefreshToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
  setCookie(REFRESH_TOKEN_KEY, token, REFRESH_TOKEN_MAX_AGE);
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Get token expiry time
 * @returns Timestamp when token expires, or null if not set
 */
export function getTokenExpiresAt(): number | null {
  if (typeof window === 'undefined') return null;
  const expiresAt = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiresAt ? parseInt(expiresAt, 10) : null;
}

/**
 * Check if access token is expired or will expire soon
 * @param bufferSeconds - Consider expired if within this many seconds (default 60)
 */
export function isTokenExpiringSoon(bufferSeconds = 60): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return true; // Assume expired if we don't know
  return Date.now() >= expiresAt - (bufferSeconds * 1000);
}

/**
 * Get seconds until token expires
 * @returns Seconds remaining, or 0 if expired/unknown
 */
export function getSecondsUntilExpiry(): number {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return 0;
  const remaining = Math.floor((expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

export function hasAccessTokenCookie(): boolean {
  return getCookie(ACCESS_TOKEN_KEY) !== null;
}

export function hasRefreshTokenCookie(): boolean {
  return getCookie(REFRESH_TOKEN_KEY) !== null;
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  deleteCookie(ACCESS_TOKEN_KEY);
  deleteCookie(REFRESH_TOKEN_KEY);
}
