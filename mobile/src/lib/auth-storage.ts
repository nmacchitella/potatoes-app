/**
 * Auth token storage utilities for React Native
 * Uses expo-secure-store for encrypted token storage
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expires_at';

// In-memory cache for faster access
let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedExpiresAt: number | null = null;

/**
 * Store access token with expiry time
 */
export async function setAccessToken(token: string, expiresIn?: number): Promise<void> {
  cachedAccessToken = token;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);

  if (expiresIn) {
    const expiresAt = Date.now() + expiresIn * 1000;
    cachedExpiresAt = expiresAt;
    await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, expiresAt.toString());
  }
}

/**
 * Store refresh token
 */
export async function setRefreshToken(token: string): Promise<void> {
  cachedRefreshToken = token;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

/**
 * Get access token (sync from cache, or async from storage)
 */
export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function getAccessTokenAsync(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;
  cachedAccessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  return cachedAccessToken;
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  return cachedRefreshToken;
}

export async function getRefreshTokenAsync(): Promise<string | null> {
  if (cachedRefreshToken) return cachedRefreshToken;
  cachedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return cachedRefreshToken;
}

/**
 * Get token expiry time
 */
export function getTokenExpiresAt(): number | null {
  return cachedExpiresAt;
}

export async function getTokenExpiresAtAsync(): Promise<number | null> {
  if (cachedExpiresAt) return cachedExpiresAt;
  const expiresAt = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
  cachedExpiresAt = expiresAt ? parseInt(expiresAt, 10) : null;
  return cachedExpiresAt;
}

/**
 * Check if access token is expired or will expire soon
 */
export function isTokenExpiringSoon(bufferSeconds = 60): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - bufferSeconds * 1000;
}

/**
 * Get seconds until token expires
 */
export function getSecondsUntilExpiry(): number {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return 0;
  const remaining = Math.floor((expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * Clear all tokens
 */
export async function clearTokens(): Promise<void> {
  cachedAccessToken = null;
  cachedRefreshToken = null;
  cachedExpiresAt = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY),
  ]);
}

/**
 * Load tokens from storage into cache (call on app start)
 */
export async function loadTokensFromStorage(): Promise<void> {
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(TOKEN_EXPIRY_KEY),
  ]);

  cachedAccessToken = accessToken;
  cachedRefreshToken = refreshToken;
  cachedExpiresAt = expiresAt ? parseInt(expiresAt, 10) : null;
}

/**
 * Check if user has stored tokens (for initial auth check)
 */
export async function hasStoredTokens(): Promise<boolean> {
  await loadTokensFromStorage();
  return cachedRefreshToken !== null;
}
