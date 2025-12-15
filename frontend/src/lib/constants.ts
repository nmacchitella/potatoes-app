/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

// API Configuration
export const API_CONFIG = {
  DEFAULT_URL: 'http://localhost:8000/api',
  PRODUCTION_URL: 'https://potatoes-backend.fly.dev/api',
  DEV_URL: 'https://potatoes-backend-dev.fly.dev/api',
} as const;

// Authentication
export const AUTH_CONFIG = {
  ACCESS_TOKEN_KEY: 'access_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  ACCESS_TOKEN_MAX_AGE_SECONDS: 15 * 60, // 15 minutes
  REFRESH_TOKEN_MAX_AGE_SECONDS: 30 * 24 * 60 * 60, // 30 days
} as const;

// Polling & Intervals
export const POLLING_INTERVALS = {
  NOTIFICATION_POLL_MS: 30000, // 30 seconds
  SEARCH_DEBOUNCE_MS: 300,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  SEARCH_LIMIT: 20,
} as const;

// UI Configuration
export const UI_CONFIG = {
  CAROUSEL_SCROLL_AMOUNT: 280,
  MODAL_ANIMATION_DURATION_MS: 200,
  TOAST_DURATION_MS: 3000,
} as const;

// Recipe Configuration
export const RECIPE_CONFIG = {
  MIN_SCALE: 0.25,
  MAX_SCALE: 10,
  DEFAULT_YIELD: 4,
  DEFAULT_DIFFICULTY: 'medium',
} as const;

// Unit Abbreviations (for recipe display)
export const UNIT_ABBREVIATIONS: Record<string, string> = {
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cup: 'cup',
  cups: 'cups',
  ounce: 'oz',
  ounces: 'oz',
  pound: 'lb',
  pounds: 'lbs',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  milliliter: 'ml',
  milliliters: 'ml',
  liter: 'L',
  liters: 'L',
  pinch: 'pinch',
  dash: 'dash',
  clove: 'clove',
  cloves: 'cloves',
  piece: 'pc',
  pieces: 'pcs',
  slice: 'slice',
  slices: 'slices',
  whole: 'whole',
  large: 'lg',
  medium: 'med',
  small: 'sm',
} as const;

/**
 * Abbreviate a unit name for display
 */
export function abbreviateUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  const lower = unit.toLowerCase();
  return UNIT_ABBREVIATIONS[lower] || unit;
}

/**
 * Format ingredient quantity for display
 * Handles whole numbers, fractions, and ranges
 */
export function formatQuantity(quantity: number | null | undefined): string {
  if (quantity === null || quantity === undefined) return '';

  // Common fractions
  const fractions: Record<number, string> = {
    0.125: '⅛',
    0.25: '¼',
    0.333: '⅓',
    0.375: '⅜',
    0.5: '½',
    0.625: '⅝',
    0.666: '⅔',
    0.75: '¾',
    0.875: '⅞',
  };

  const whole = Math.floor(quantity);
  const decimal = quantity - whole;

  // Check if decimal matches a common fraction
  const fractionKey = Object.keys(fractions)
    .map(Number)
    .find(key => Math.abs(decimal - key) < 0.01);

  if (fractionKey !== undefined) {
    const fraction = fractions[fractionKey];
    return whole > 0 ? `${whole}${fraction}` : fraction;
  }

  // Otherwise, round to reasonable precision
  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }
  return quantity.toFixed(2).replace(/\.?0+$/, '');
}

interface Ingredient {
  name: string;
  quantity?: number | null;
  quantity_max?: number | null;
  unit?: string | null;
  preparation?: string | null;
}

/**
 * Format a recipe ingredient for display
 * Combines quantity, unit, name, and preparation into a readable string
 */
export function formatIngredient(ing: Ingredient): string {
  const parts: string[] = [];

  // Format quantity (and range if applicable)
  if (ing.quantity) {
    const qty = formatQuantity(ing.quantity);
    if (ing.quantity_max) {
      const qtyMax = formatQuantity(ing.quantity_max);
      parts.push(`${qty}-${qtyMax}`);
    } else {
      parts.push(qty);
    }
  }

  // Format unit
  if (ing.unit) {
    const abbr = abbreviateUnit(ing.unit);
    if (abbr) {
      // Metric units attach directly to quantity (e.g., "100g" not "100 g")
      const metricUnits = ['g', 'kg', 'mg', 'ml', 'L'];
      if (metricUnits.includes(abbr) && parts.length > 0) {
        parts[parts.length - 1] = (parts[parts.length - 1] || '') + abbr;
      } else {
        parts.push(abbr);
      }
    }
  }

  // Add ingredient name
  parts.push(ing.name);

  // Add preparation if present
  if (ing.preparation) {
    parts[parts.length - 1] += `, ${ing.preparation}`;
  }

  return parts.join(' ');
}
