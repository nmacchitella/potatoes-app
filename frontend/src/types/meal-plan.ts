import type { ShareableUser } from './user';

// ============================================================================
// MEAL PLAN CALENDAR TYPES
// ============================================================================

export interface MealPlanCalendar {
  id: string;
  name: string;
  is_owner: boolean;
  permission?: 'viewer' | 'editor';
  owner?: ShareableUser;
  share_count: number;
  created_at: string;
  updated_at?: string;
}

export interface MealPlanCalendarCreateInput {
  name?: string;
}

export interface MealPlanCalendarUpdateInput {
  name?: string;
}

// ============================================================================
// MEAL PLAN TYPES
// ============================================================================

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealPlanRecipe {
  id: string;
  title: string;
  cover_image_url?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
}

export interface MealPlan {
  id: string;
  calendar_id: string;
  planned_date: string; // ISO date string YYYY-MM-DD
  meal_type: MealType;
  servings: number;
  notes?: string;
  recurrence_id?: string;
  recipe?: MealPlanRecipe;
  custom_title?: string;
  custom_description?: string;
  created_at: string;
}

export interface MealPlanCreateInput {
  calendar_id: string;
  recipe_id?: string;
  custom_title?: string;
  custom_description?: string;
  planned_date: string;
  meal_type: MealType;
  servings?: number;
  notes?: string;
}

export interface MealPlanUpdateInput {
  planned_date?: string;
  meal_type?: MealType;
  servings?: number;
  notes?: string;
  custom_title?: string;
  custom_description?: string;
}

export interface MealPlanMoveInput {
  planned_date: string;
  meal_type: MealType;
}

export interface MealPlanCopyInput {
  source_start: string;
  source_end: string;
  target_start: string;
}

export interface MealPlanRecurringInput {
  recipe_id: string;
  meal_type: MealType;
  day_of_week: number; // 0=Monday, 6=Sunday
  start_date: string;
  end_date: string;
  servings?: number;
}

export interface MealPlanListResponse {
  items: MealPlan[];
  start_date: string;
  end_date: string;
  calendar_ids: string[];
}

// ============================================================================
// MEAL PLAN CALENDAR SHARING
// ============================================================================

export type MealPlanShareUser = ShareableUser;

export interface MealPlanCalendarShare {
  id: string;
  calendar_id: string;
  user_id: string;
  permission: 'viewer' | 'editor';
  created_at: string;
  user: MealPlanShareUser;
}

export interface SharedMealPlanCalendarAccess {
  id: string;
  calendar_id: string;
  calendar_name: string;
  owner: MealPlanShareUser;
  permission: 'viewer' | 'editor';
  created_at: string;
}

export interface MealPlanCalendarShareCreateInput {
  user_id: string;
  permission: 'viewer' | 'editor';
}

export interface MealPlanCalendarShareUpdateInput {
  permission: 'viewer' | 'editor';
}

// Deprecated aliases for backwards compatibility
export type MealPlanShare = MealPlanCalendarShare;
export type SharedMealPlanAccess = SharedMealPlanCalendarAccess;
export type MealPlanShareCreateInput = MealPlanCalendarShareCreateInput;
export type MealPlanShareUpdateInput = MealPlanCalendarShareUpdateInput;
