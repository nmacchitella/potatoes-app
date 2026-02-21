/**
 * Type re-exports — all existing imports from '@/types' continue to work.
 * Import directly from the domain files for better tree-shaking:
 *   import type { Recipe } from '@/types/recipe';
 */

export * from './user';
export * from './recipe';
export * from './meal-plan';
export * from './grocery';
export * from './search';
export * from './library';
