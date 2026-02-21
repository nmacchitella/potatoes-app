// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
  bio?: string;
  is_public: boolean;
  profile_image_url?: string;
  follower_count?: number;
  following_count?: number;
}

export interface UserProfileUpdate {
  name?: string;
  bio?: string;
  is_public?: boolean;
}

export interface UserSettings {
  user_id: string;
  preferred_unit_system: 'metric' | 'imperial';
  default_servings: number;
  email_new_follower: boolean;
  email_follow_request: boolean;
  email_recipe_saved: boolean;
  updated_at: string;
}

export interface UserSettingsUpdate {
  preferred_unit_system?: 'metric' | 'imperial';
  default_servings?: number;
  email_new_follower?: boolean;
  email_follow_request?: boolean;
  email_recipe_saved?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds until access token expires
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  is_actionable?: boolean | null;
}

// ============================================================================
// SOCIAL / FOLLOW
// ============================================================================

export interface UserSearchResult {
  id: string;
  name: string;
  profile_image_url?: string;
  is_public: boolean;
  is_followed_by_me: boolean;
  follow_status?: 'pending' | 'confirmed' | null;
}

export interface FollowResponse {
  status: 'pending' | 'confirmed';
  message: string;
}

export interface UserProfilePublic {
  id: string;
  name: string;
  bio?: string;
  profile_image_url?: string;
  is_public: boolean;
  follower_count: number;
  following_count: number;
  is_followed_by_me: boolean;
  follow_status?: 'pending' | 'confirmed' | null;
}

// ============================================================================
// SHARED USER TYPE (used across Collection, MealPlan, GroceryList sharing)
// ============================================================================

/**
 * Common user info for all sharing contexts.
 */
export interface ShareableUser {
  id: string;
  name: string;
  profile_image_url?: string;
}
