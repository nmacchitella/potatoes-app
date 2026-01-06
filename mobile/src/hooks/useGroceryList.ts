import { useState, useEffect, useCallback } from 'react';
import { groceryListApi } from '@/lib/api';
import type {
  GroceryList, GroceryListItem,
  GroceryListItemCreateInput, SharedGroceryListAccess
} from '@/types';

// Category display order and labels
export const CATEGORY_ORDER = [
  'produce',
  'dairy',
  'meat',
  'bakery',
  'frozen',
  'pantry',
  'beverages',
  'staples',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat & Seafood',
  bakery: 'Bakery',
  frozen: 'Frozen',
  pantry: 'Pantry',
  beverages: 'Beverages',
  staples: 'Check Pantry',
  // Additional categories that might come from ingredients
  spices: 'Spices & Seasonings',
  condiments: 'Condiments',
  grains: 'Grains & Pasta',
  canned: 'Canned Goods',
  snacks: 'Snacks',
  other: 'Other',
};

export function useGroceryList() {
  // Grocery list data
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate state
  const [isGenerating, setIsGenerating] = useState(false);

  // Shared with me
  const [sharedWithMe, setSharedWithMe] = useState<SharedGroceryListAccess[]>([]);

  // Load grocery list on mount
  const loadGroceryList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, shared] = await Promise.all([
        groceryListApi.get(),
        groceryListApi.listSharedWithMe(),
      ]);
      setGroceryList(list);
      setSharedWithMe(shared);
    } catch (err) {
      console.error('Failed to load grocery list:', err);
      setError('Failed to load grocery list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroceryList();
  }, [loadGroceryList]);

  // Toggle item checked
  const toggleItemChecked = useCallback(async (itemId: string) => {
    if (!groceryList) return;

    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    // Optimistic update
    setGroceryList(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(i =>
          i.id === itemId ? { ...i, is_checked: !i.is_checked } : i
        ),
        items_by_category: Object.fromEntries(
          Object.entries(prev.items_by_category).map(([cat, items]) => [
            cat,
            items.map(i => i.id === itemId ? { ...i, is_checked: !i.is_checked } : i)
          ])
        ),
      };
    });

    try {
      await groceryListApi.updateItem(itemId, { is_checked: !item.is_checked });
    } catch (err) {
      console.error('Failed to update item:', err);
      // Revert on error
      loadGroceryList();
    }
  }, [groceryList, loadGroceryList]);

  // Toggle item staple status
  const toggleItemStaple = useCallback(async (itemId: string, isStaple: boolean) => {
    if (!groceryList) return;

    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    // Determine old and new category
    const oldCategory = item.category || 'pantry';
    const newCategory = isStaple ? 'staples' : (oldCategory === 'staples' ? 'pantry' : oldCategory);

    // Optimistic update
    setGroceryList(prev => {
      if (!prev) return prev;

      const updatedItem = { ...item, is_staple: isStaple, category: newCategory };

      // Remove from old category and add to new
      const newItemsByCategory = { ...prev.items_by_category };

      // Remove from old category
      if (newItemsByCategory[oldCategory]) {
        newItemsByCategory[oldCategory] = newItemsByCategory[oldCategory].filter(i => i.id !== itemId);
      }

      // Add to new category
      if (!newItemsByCategory[newCategory]) {
        newItemsByCategory[newCategory] = [];
      }
      newItemsByCategory[newCategory] = [...newItemsByCategory[newCategory], updatedItem];

      return {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updatedItem : i),
        items_by_category: newItemsByCategory,
      };
    });

    try {
      await groceryListApi.updateItem(itemId, { is_staple: isStaple, category: newCategory });
    } catch (err) {
      console.error('Failed to update item:', err);
      loadGroceryList();
    }
  }, [groceryList, loadGroceryList]);

  // Add item
  const addItem = useCallback(async (data: GroceryListItemCreateInput) => {
    try {
      const newItem = await groceryListApi.addItem(data);
      setGroceryList(prev => {
        if (!prev) return prev;
        const category = newItem.category || 'pantry';
        return {
          ...prev,
          items: [...prev.items, newItem],
          items_by_category: {
            ...prev.items_by_category,
            [category]: [...(prev.items_by_category[category] || []), newItem],
          },
        };
      });
      return newItem;
    } catch (err) {
      console.error('Failed to add item:', err);
      throw err;
    }
  }, []);

  // Delete item
  const deleteItem = useCallback(async (itemId: string) => {
    if (!groceryList) return;

    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    // Optimistic update
    setGroceryList(prev => {
      if (!prev) return prev;
      const category = item.category || 'pantry';
      return {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
        items_by_category: {
          ...prev.items_by_category,
          [category]: (prev.items_by_category[category] || []).filter(i => i.id !== itemId),
        },
      };
    });

    try {
      await groceryListApi.deleteItem(itemId);
    } catch (err) {
      console.error('Failed to delete item:', err);
      loadGroceryList();
    }
  }, [groceryList, loadGroceryList]);

  // Clear checked items
  const clearCheckedItems = useCallback(async () => {
    try {
      await groceryListApi.clear(true);
      await loadGroceryList();
    } catch (err) {
      console.error('Failed to clear checked items:', err);
    }
  }, [loadGroceryList]);

  // Clear all items
  const clearAllItems = useCallback(async () => {
    try {
      await groceryListApi.clear(false);
      await loadGroceryList();
    } catch (err) {
      console.error('Failed to clear all items:', err);
    }
  }, [loadGroceryList]);

  // Generate from meal plan
  const generateFromMealPlan = useCallback(async (
    startDate: string,
    endDate: string,
    merge: boolean
  ) => {
    setIsGenerating(true);
    try {
      const list = await groceryListApi.generate({
        start_date: startDate,
        end_date: endDate,
        merge,
      });
      setGroceryList(list);
      return list;
    } catch (err) {
      console.error('Failed to generate grocery list:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Get all categories that have items (including those not in CATEGORY_ORDER)
  const getAllCategories = useCallback(() => {
    if (!groceryList) return [];

    const orderedCategories: string[] = [];
    const additionalCategories: string[] = [];

    // Add categories in order
    for (const cat of CATEGORY_ORDER) {
      if (groceryList.items_by_category[cat]?.length > 0) {
        orderedCategories.push(cat);
      }
    }

    // Add any additional categories not in CATEGORY_ORDER
    for (const cat of Object.keys(groceryList.items_by_category)) {
      if (!CATEGORY_ORDER.includes(cat as typeof CATEGORY_ORDER[number]) &&
          groceryList.items_by_category[cat]?.length > 0) {
        additionalCategories.push(cat);
      }
    }

    return [...orderedCategories, ...additionalCategories];
  }, [groceryList]);

  return {
    // Grocery list data
    groceryList,
    loading,
    error,

    // Item operations
    toggleItemChecked,
    toggleItemStaple,
    addItem,
    deleteItem,
    clearCheckedItems,
    clearAllItems,

    // Generate from meal plan
    isGenerating,
    generateFromMealPlan,

    // Shared
    sharedWithMe,

    // Helpers
    getAllCategories,

    // Refresh
    refresh: loadGroceryList,
  };
}
