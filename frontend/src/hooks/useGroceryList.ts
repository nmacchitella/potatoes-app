import { useState, useEffect, useCallback } from 'react';
import { groceryListApi } from '@/lib/api';
import type {
  GroceryList, GroceryListShare,
  GroceryListItemCreateInput, UserSearchResult,
} from '@/types';
import { useGroceryLists } from './useGroceryLists';
import { useGroceryListSharing } from './useGroceryListSharing';

// Category display order and labels — exported for use in components
export const CATEGORY_ORDER = [
  'produce',
  'dairy',
  'meat',
  'deli',
  'bakery',
  'frozen',
  'pantry',
  'grains',
  'canned',
  'oils',
  'spices',
  'condiments',
  'baking',
  'beverages',
  'snacks',
  'nuts',
  'international',
  'health',
  'staples',
  'other',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat & Seafood',
  deli: 'Deli',
  bakery: 'Bakery',
  frozen: 'Frozen',
  pantry: 'Pantry',
  grains: 'Grains & Pasta',
  canned: 'Canned Goods',
  oils: 'Oils & Vinegars',
  spices: 'Spices & Seasonings',
  condiments: 'Condiments',
  baking: 'Baking',
  beverages: 'Beverages',
  snacks: 'Snacks',
  nuts: 'Nuts & Seeds',
  international: 'International',
  health: 'Health Foods',
  staples: 'Check Pantry',
  other: 'Other',
};

interface UseGroceryListReturn {
  // Lists management (from useGroceryLists)
  myLists: ReturnType<typeof useGroceryLists>['myLists'];
  sharedWithMe: ReturnType<typeof useGroceryLists>['sharedWithMe'];
  loadingLists: boolean;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  createList: ReturnType<typeof useGroceryLists>['createList'];
  renameList: ReturnType<typeof useGroceryLists>['renameList'];
  deleteList: ReturnType<typeof useGroceryLists>['deleteList'];

  // Grocery list data
  groceryList: GroceryList | null;
  loading: boolean;
  error: string | null;

  // Item operations
  toggleItemChecked: (itemId: string) => Promise<void>;
  toggleItemStaple: (itemId: string, isStaple: boolean) => Promise<void>;
  addItem: (data: GroceryListItemCreateInput) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  changeItemCategory: (itemId: string, newCategory: string) => Promise<void>;
  clearCheckedItems: () => Promise<void>;
  clearAllItems: () => Promise<void>;

  // Generate from meal plan
  isGenerating: boolean;
  generateFromMealPlan: (startDate: string, endDate: string, merge: boolean, calendarIds?: string[]) => Promise<void>;
  isGenerateModalOpen: boolean;
  setIsGenerateModalOpen: (open: boolean) => void;

  // Sharing (from useGroceryListSharing)
  shares: GroceryListShare[];
  loadingShares: boolean;
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  userSearchResults: UserSearchResult[];
  searchingUsers: boolean;
  sharingUser: string | null;
  handleShareWithUser: (userId: string) => Promise<void>;
  handleRemoveShare: (userId: string) => Promise<void>;
  acceptShare: (shareId: string) => Promise<void>;
  declineShare: (shareId: string) => Promise<void>;
  leaveSharedList: (shareId: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
  refreshLists: () => Promise<void>;
}

export function useGroceryList(): UseGroceryListReturn {
  // --- Sub-hooks ---
  const {
    myLists, setMyLists,
    sharedWithMe, setSharedWithMe,
    loadingLists,
    selectedListId, setSelectedListId,
    loadLists,
    createList, renameList, deleteList,
  } = useGroceryLists();

  // --- Selected list data ---
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shares, setShares] = useState<GroceryListShare[]>([]);

  // Generate state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // --- Sharing sub-hook ---
  const sharing = useGroceryListSharing({
    selectedListId,
    shares,
    setShares,
    sharedWithMe,
    setSharedWithMe,
    setSelectedListId,
  });

  // Load selected list
  const loadGroceryList = useCallback(async () => {
    if (!selectedListId) {
      setGroceryList(null);
      setShares([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await groceryListApi.get(selectedListId);
      setGroceryList(list);
      setShares(list.shares);
    } catch (err) {
      console.error('Failed to load grocery list:', err);
      setError('Failed to load grocery list');
      setGroceryList(null);
    } finally {
      setLoading(false);
    }
  }, [selectedListId]);

  useEffect(() => {
    loadGroceryList();
  }, [selectedListId]);

  // ============================================================================
  // ITEM OPERATIONS
  // ============================================================================

  const toggleItemChecked = useCallback(async (itemId: string) => {
    if (!groceryList || !selectedListId) return;
    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    setGroceryList(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, is_checked: !i.is_checked } : i),
        items_by_category: Object.fromEntries(
          Object.entries(prev.items_by_category).map(([cat, items]) => [
            cat,
            items.map(i => i.id === itemId ? { ...i, is_checked: !i.is_checked } : i),
          ])
        ),
      };
    });

    try {
      await groceryListApi.updateItem(selectedListId, itemId, { is_checked: !item.is_checked });
    } catch (err) {
      console.error('Failed to update item:', err);
      loadGroceryList();
    }
  }, [groceryList, selectedListId, loadGroceryList]);

  const toggleItemStaple = useCallback(async (itemId: string, isStaple: boolean) => {
    if (!groceryList || !selectedListId) return;
    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    const oldCategory = item.category || 'pantry';
    const newCategory = isStaple ? 'staples' : (oldCategory === 'staples' ? 'pantry' : oldCategory);

    setGroceryList(prev => {
      if (!prev) return prev;
      const updatedItem = { ...item, is_staple: isStaple, category: newCategory };
      const newItemsByCategory = { ...prev.items_by_category };
      if (newItemsByCategory[oldCategory]) {
        newItemsByCategory[oldCategory] = newItemsByCategory[oldCategory].filter(i => i.id !== itemId);
      }
      newItemsByCategory[newCategory] = [...(newItemsByCategory[newCategory] || []), updatedItem];
      return {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updatedItem : i),
        items_by_category: newItemsByCategory,
      };
    });

    try {
      await groceryListApi.updateItem(selectedListId, itemId, { is_staple: isStaple, category: newCategory });
    } catch (err) {
      console.error('Failed to update item:', err);
      loadGroceryList();
    }
  }, [groceryList, selectedListId, loadGroceryList]);

  const addItem = useCallback(async (data: GroceryListItemCreateInput) => {
    if (!selectedListId) throw new Error('No list selected');
    const newItem = await groceryListApi.addItem(selectedListId, data);
    const category = newItem.category || 'pantry';
    setGroceryList(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, newItem],
        items_by_category: {
          ...prev.items_by_category,
          [category]: [...(prev.items_by_category[category] || []), newItem],
        },
      };
    });
    setMyLists(prev => prev.map(l =>
      l.id === selectedListId ? { ...l, item_count: l.item_count + 1 } : l
    ));
  }, [selectedListId, setMyLists]);

  const deleteItem = useCallback(async (itemId: string) => {
    if (!groceryList || !selectedListId) return;
    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    const category = item.category || 'pantry';
    setGroceryList(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
        items_by_category: {
          ...prev.items_by_category,
          [category]: (prev.items_by_category[category] || []).filter(i => i.id !== itemId),
        },
      };
    });
    setMyLists(prev => prev.map(l =>
      l.id === selectedListId ? { ...l, item_count: Math.max(0, l.item_count - 1) } : l
    ));

    try {
      await groceryListApi.deleteItem(selectedListId, itemId);
    } catch (err) {
      console.error('Failed to delete item:', err);
      loadGroceryList();
    }
  }, [groceryList, selectedListId, setMyLists, loadGroceryList]);

  const changeItemCategory = useCallback(async (itemId: string, newCategory: string) => {
    if (!groceryList || !selectedListId) return;
    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    const oldCategory = item.category || 'pantry';
    const updatedItem = { ...item, category: newCategory };

    setGroceryList(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updatedItem : i),
        items_by_category: {
          ...prev.items_by_category,
          [oldCategory]: (prev.items_by_category[oldCategory] || []).filter(i => i.id !== itemId),
          [newCategory]: [...(prev.items_by_category[newCategory] || []), updatedItem],
        },
      };
    });

    try {
      await groceryListApi.updateItem(selectedListId, itemId, { category: newCategory });
    } catch (err) {
      console.error('Failed to change item category:', err);
      loadGroceryList();
      throw err;
    }
  }, [groceryList, selectedListId, loadGroceryList]);

  const clearCheckedItems = useCallback(async () => {
    if (!selectedListId) return;
    await groceryListApi.clear(selectedListId, true);
    await loadGroceryList();
    await loadLists();
  }, [selectedListId, loadGroceryList, loadLists]);

  const clearAllItems = useCallback(async () => {
    if (!selectedListId) return;
    await groceryListApi.clear(selectedListId, false);
    await loadGroceryList();
    await loadLists();
  }, [selectedListId, loadGroceryList, loadLists]);

  // ============================================================================
  // GENERATE FROM MEAL PLAN
  // ============================================================================

  const generateFromMealPlan = useCallback(async (
    startDate: string,
    endDate: string,
    merge: boolean,
    calendarIds?: string[]
  ) => {
    if (!selectedListId) throw new Error('No list selected');
    setIsGenerating(true);
    try {
      const list = await groceryListApi.generate(selectedListId, {
        start_date: startDate,
        end_date: endDate,
        merge,
        calendar_ids: calendarIds,
      });
      setGroceryList(list);
      setIsGenerateModalOpen(false);
      await loadLists();
    } finally {
      setIsGenerating(false);
    }
  }, [selectedListId, loadLists]);

  return {
    // Lists management
    myLists,
    sharedWithMe,
    loadingLists,
    selectedListId,
    setSelectedListId,
    createList,
    renameList,
    deleteList,

    // Grocery list data
    groceryList,
    loading,
    error,

    // Item operations
    toggleItemChecked,
    toggleItemStaple,
    addItem,
    deleteItem,
    changeItemCategory,
    clearCheckedItems,
    clearAllItems,

    // Generate from meal plan
    isGenerating,
    generateFromMealPlan,
    isGenerateModalOpen,
    setIsGenerateModalOpen,

    // Sharing
    shares,
    ...sharing,

    // Refresh
    refresh: loadGroceryList,
    refreshLists: loadLists,
  };
}
