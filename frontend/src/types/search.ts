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
