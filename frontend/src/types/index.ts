export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
  username?: string;
  bio?: string;
  is_public: boolean;
  profile_image_url?: string;
  follower_count?: number;
  following_count?: number;
}

export interface UserProfileUpdate {
  name?: string;
  username?: string;
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
}

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
  is_actionable?: boolean | null; // For follow_request: true if still pending
}

export interface UserSearchResult {
  id: string;
  name: string;
  username?: string;
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
  username?: string;
  bio?: string;
  profile_image_url?: string;
  is_public: boolean;
  follower_count: number;
  following_count: number;
  is_followed_by_me: boolean;
  follow_status?: 'pending' | 'confirmed' | null;
}

// ============================================================================
// RECIPE TYPES
// ============================================================================

export interface RecipeIngredient {
  id: string;
  sort_order: number;
  quantity?: number;
  quantity_max?: number;
  unit?: string;
  name: string;
  preparation?: string;
  is_optional: boolean;
  is_staple: boolean;
  ingredient_group?: string;
  notes?: string;
}

export interface RecipeIngredientInput {
  sort_order?: number;
  quantity?: number;
  quantity_max?: number;
  unit?: string;
  name: string;
  preparation?: string;
  is_optional?: boolean;
  is_staple?: boolean;
  ingredient_group?: string;
  notes?: string;
}

export interface RecipeInstruction {
  id: string;
  step_number: number;
  instruction_text: string;
  duration_minutes?: number;
  instruction_group?: string;
}

export interface RecipeInstructionInput {
  step_number: number;
  instruction_text: string;
  duration_minutes?: number;
  instruction_group?: string;
}

export interface Tag {
  id: string;
  name: string;
  category?: string;
  is_system: boolean;
  created_at: string;
}

export interface RecipeAuthor {
  id: string;
  name: string;
  username?: string;
  profile_image_url?: string;
}

export interface RecipeSummary {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  yield_quantity: number;
  yield_unit: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  privacy_level: 'private' | 'public';
  status: 'draft' | 'published';
  author: RecipeAuthor;
  tags: Tag[];
  created_at: string;
}

export interface ForkedFromInfo {
  recipe_id?: string;
  user_id?: string;
  user_name?: string;
  user_username?: string;
}

export interface ClonedByMeInfo {
  cloned_recipe_id: string;
  cloned_at: string;
}

export interface Recipe extends RecipeSummary {
  author_id: string;
  source_url?: string;
  source_name?: string;
  notes?: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  updated_at: string;
  forked_from?: ForkedFromInfo;
}

export interface RecipeWithScale extends Recipe {
  scale_factor: number;
  scaled_yield_quantity: number;
  cloned_by_me?: ClonedByMeInfo;
}

export interface RecipeCreateInput {
  title: string;
  description?: string;
  yield_quantity?: number;
  yield_unit?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  privacy_level?: 'private' | 'public';
  source_url?: string;
  source_name?: string;
  cover_image_url?: string;
  notes?: string;
  status?: 'draft' | 'published';
  ingredients?: RecipeIngredientInput[];
  instructions?: RecipeInstructionInput[];
  tag_ids?: string[];
  collection_ids?: string[];
}

export interface RecipeUpdateInput extends Partial<RecipeCreateInput> {}

export interface RecipeListResponse {
  items: RecipeSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RecipeListParams {
  search?: string;
  tag_ids?: string;
  collection_id?: string;
  difficulty?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// COLLECTION TYPES
// ============================================================================

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  is_default: boolean;
  privacy_level: 'private' | 'public';
  sort_order: number;
  created_at: string;
  updated_at: string;
  recipe_count: number;
}

export interface CollectionWithRecipes extends Collection {
  recipes: RecipeSummary[];
}

export interface CollectionCreateInput {
  name: string;
  description?: string;
  cover_image_url?: string;
  privacy_level?: 'private' | 'public';
}

export interface CollectionUpdateInput extends Partial<CollectionCreateInput> {
  sort_order?: number;
}

// ============================================================================
// INGREDIENT PARSER TYPES
// ============================================================================

export interface ParsedIngredient {
  quantity?: number;
  quantity_max?: number;
  unit?: string;
  name: string;
  preparation?: string;
  notes?: string;
  original_text: string;
}

// ============================================================================
// MASTER INGREDIENT TYPES (for autocomplete)
// ============================================================================

export interface Ingredient {
  id: string;
  name: string;
  category?: string;
  is_system: boolean;
  user_id?: string;
  created_at: string;
}

export interface MeasurementUnit {
  id: string;
  name: string;
  abbreviation?: string;
  type?: string;
  is_system: boolean;
}

// ============================================================================
// RECIPE IMPORT TYPES
// ============================================================================

export interface ImportedIngredient {
  name: string;
  quantity?: number;
  quantity_max?: number;
  unit?: string;
  preparation?: string;
  is_optional: boolean;
  notes?: string;
}

export interface ImportedInstruction {
  step_number: number;
  instruction_text: string;
  duration_minutes?: number;
}

export interface RecipeImportResponse {
  title: string;
  description?: string;
  ingredients: ImportedIngredient[];
  instructions: ImportedInstruction[];
  yield_quantity: number;
  yield_unit: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  source_url?: string;
  source_name?: string;
  cover_image_url?: string;
  tags: string[];
}

export interface RecipeImportMultiResponse {
  recipes: RecipeImportResponse[];
  source_type: 'webpage' | 'youtube';
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SearchRecipeResult {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  author_name: string;
  is_own: boolean;
}

export interface SearchTagResult {
  id: string;
  name: string;
  category?: string;
  recipe_count: number;
}

export interface SearchCollectionResult {
  id: string;
  name: string;
  description?: string;
  recipe_count: number;
}

export interface SearchUserResult {
  id: string;
  name: string;
  username?: string;
  profile_image_url?: string;
}

export interface SearchIngredientResult {
  id: string;
  name: string;
  category?: string;
  recipe_count: number;
}

export interface SearchResponse {
  my_recipes: SearchRecipeResult[];
  discover_recipes: SearchRecipeResult[];
  tags: SearchTagResult[];
  collections: SearchCollectionResult[];
  users: SearchUserResult[];
  ingredients: SearchIngredientResult[];
  query: string;
}

export interface FullSearchResponse {
  recipes: SearchRecipeResult[];
  recipes_total: number;
  tags: SearchTagResult[];
  tags_total: number;
  collections: SearchCollectionResult[];
  collections_total: number;
  users: SearchUserResult[];
  users_total: number;
  ingredients: SearchIngredientResult[];
  ingredients_total: number;
  query: string;
}
