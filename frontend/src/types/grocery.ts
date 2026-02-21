import type { ShareableUser } from './user';

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

export type GroceryListShareUser = ShareableUser;

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
  share_count: number;
  share_token?: string;
  created_at: string;
  updated_at?: string;
}

export interface GroceryListEmailShareResponse {
  success: boolean;
  is_existing_user: boolean;
  message: string;
}

export interface GroceryListAcceptPublicShareResponse {
  grocery_list_id: string;
  grocery_list_name: string;
  already_had_access: boolean;
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
  calendar_ids?: string[];
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
