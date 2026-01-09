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
  expires_in: number;  // seconds until access token expires
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
  profile_image_url?: string;
}

export interface CollectionInfo {
  id: string;
  name: string;
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
  collections: CollectionInfo[];
  created_at: string;
}

export interface ForkedFromInfo {
  recipe_id?: string;
  user_id?: string;
  user_name?: string;
}

export interface ClonedByMeInfo {
  cloned_recipe_id: string;
  cloned_at: string;
}

// Sub-recipe types (composite recipes like Lasagna = Ragù + Besciamella)
export interface SubRecipeInput {
  sub_recipe_id: string;
  sort_order?: number;
  scale_factor?: number;
  section_title?: string;
}

export interface SubRecipeInfo {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  yield_quantity?: number;
  yield_unit?: string;
  sort_order: number;
  scale_factor: number;
  section_title?: string;
  ingredients: RecipeIngredient[];
}

export interface Recipe extends RecipeSummary {
  author_id: string;
  source_url?: string;
  source_name?: string;
  video_start_seconds?: number;
  notes?: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  sub_recipes: SubRecipeInfo[];
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
  video_start_seconds?: number;
  cover_image_url?: string;
  notes?: string;
  status?: 'draft' | 'published';
  ingredients?: RecipeIngredientInput[];
  instructions?: RecipeInstructionInput[];
  tag_ids?: string[];
  collection_ids?: string[];
  sub_recipe_inputs?: SubRecipeInput[];
}

export interface RecipeUpdateInput extends Omit<Partial<RecipeCreateInput>, 'cover_image_url'> {
  cover_image_url?: string | null;
}

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

// --- Collection Sharing Types ---
export interface CollectionShareUser {
  id: string;
  name: string;
  profile_image_url?: string;
}

export interface CollectionShare {
  id: string;
  collection_id: string;
  user_id: string;
  permission: 'viewer' | 'editor';
  invited_by_id?: string;
  created_at: string;
  user: CollectionShareUser;
}

export interface CollectionShareCreateInput {
  user_id: string;
  permission: 'viewer' | 'editor';
}

export interface CollectionShareUpdateInput {
  permission: 'viewer' | 'editor';
}

export interface SharedCollection {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  recipe_count: number;
  permission: 'viewer' | 'editor';
  owner: CollectionShareUser;
  created_at: string;
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
  video_start_seconds?: number;
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
  planned_date: string; // ISO date string YYYY-MM-DD
  meal_type: MealType;
  servings: number;
  notes?: string;
  recurrence_id?: string;
  recipe: MealPlanRecipe;
  created_at: string;
}

export interface MealPlanCreateInput {
  recipe_id: string;
  planned_date: string; // ISO date string YYYY-MM-DD
  meal_type: MealType;
  servings?: number;
  notes?: string;
}

export interface MealPlanUpdateInput {
  planned_date?: string;
  meal_type?: MealType;
  servings?: number;
  notes?: string;
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
}

// Meal Plan Sharing
export interface MealPlanShareUser {
  id: string;
  name: string;
  profile_image_url?: string;
}

export interface MealPlanShare {
  id: string;
  permission: 'viewer' | 'editor';
  created_at: string;
  shared_with: MealPlanShareUser;
}

export interface SharedMealPlanAccess {
  id: string;
  owner: MealPlanShareUser;
  permission: 'viewer' | 'editor';
  created_at: string;
}

export interface MealPlanShareCreateInput {
  user_id: string;
  permission: 'viewer' | 'editor';
}

export interface MealPlanShareUpdateInput {
  permission: 'viewer' | 'editor';
}

// ============================================================================
// GROCERY LIST TYPES
// ============================================================================

export interface SourceRecipeInfo {
  id: string;
  title: string;
}

export interface GroceryListItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  is_checked: boolean;
  is_staple: boolean;
  is_manual: boolean;
  source_recipe_ids?: string[];
  source_recipes: SourceRecipeInfo[];
  sort_order: number;
  created_at: string;
}

export interface GroceryListShareUser {
  id: string;
  name: string;
  profile_image_url?: string;
}

export interface GroceryListShare {
  id: string;
  user_id: string;
  permission: 'editor';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  user: GroceryListShareUser;
}

export interface GroceryList {
  id: string;
  name: string;
  items: GroceryListItem[];
  items_by_category: Record<string, GroceryListItem[]>;
  shares: GroceryListShare[];
  created_at: string;
  updated_at?: string;
}

export interface GroceryListSummary {
  id: string;
  name: string;
  item_count: number;
  share_token?: string;
  created_at: string;
  updated_at?: string;
}

export interface GroceryListCreateInput {
  name?: string;
}

export interface GroceryListUpdateInput {
  name?: string;
}

export interface GroceryListItemCreateInput {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

export interface GroceryListItemUpdateInput {
  name?: string;
  quantity?: number;
  unit?: string;
  is_checked?: boolean;
  is_staple?: boolean;
  category?: string;
  sort_order?: number;
}

export interface GroceryListGenerateInput {
  start_date: string;
  end_date: string;
  merge: boolean;
}

export interface GroceryListShareCreateInput {
  user_id: string;
}

export interface GroceryListShareUpdateInput {
  permission: 'editor';
}

export interface SharedGroceryListAccess {
  id: string;
  grocery_list_id: string;
  grocery_list_name: string;
  owner: GroceryListShareUser;
  permission: 'editor';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}
