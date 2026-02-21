import type { ShareableUser } from './user';

// ============================================================================
// RECIPE INGREDIENT & INSTRUCTION TYPES
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

// ============================================================================
// TAGS
// ============================================================================

export interface Tag {
  id: string;
  name: string;
  category?: string;
  is_system: boolean;
  created_at: string;
}

// ============================================================================
// RECIPE TYPES
// ============================================================================

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
  owner?: ShareableUser; // Present for partner collections (library sharing)
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

export type CollectionShareUser = ShareableUser;

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
