import { useState, useEffect, useCallback } from 'react';
import { groceryListApi, socialApi } from '@/lib/api';
import type {
  GroceryList, GroceryListItem, GroceryListShare,
  GroceryListItemCreateInput, SharedGroceryListAccess, UserSearchResult
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

interface UseGroceryListReturn {
  // Grocery list data
  groceryList: GroceryList | null;
  loading: boolean;
  error: string | null;

  // Item operations
  toggleItemChecked: (itemId: string) => Promise<void>;
  toggleItemStaple: (itemId: string, isStaple: boolean) => Promise<void>;
  addItem: (data: GroceryListItemCreateInput) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  clearCheckedItems: () => Promise<void>;
  clearAllItems: () => Promise<void>;

  // Generate from meal plan
  isGenerating: boolean;
  generateFromMealPlan: (startDate: string, endDate: string, merge: boolean) => Promise<void>;
  isGenerateModalOpen: boolean;
  setIsGenerateModalOpen: (open: boolean) => void;

  // Sharing
  isShareModalOpen: boolean;
  shares: GroceryListShare[];
  loadingShares: boolean;
  sharedWithMe: SharedGroceryListAccess[];
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  userSearchResults: UserSearchResult[];
  searchingUsers: boolean;
  sharingUser: string | null;
  openShareModal: () => void;
  closeShareModal: () => void;
  handleShareWithUser: (userId: string, permission?: 'viewer' | 'editor') => Promise<void>;
  handleUpdatePermission: (userId: string, permission: 'viewer' | 'editor') => Promise<void>;
  handleRemoveShare: (userId: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useGroceryList(): UseGroceryListReturn {
  // Grocery list data
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // Sharing state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shares, setShares] = useState<GroceryListShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [sharedWithMe, setSharedWithMe] = useState<SharedGroceryListAccess[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sharingUser, setSharingUser] = useState<string | null>(null);

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
      setShares(list.shares);
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

  // User search for sharing (debounced)
  useEffect(() => {
    if (!userSearchQuery.trim() || userSearchQuery.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const results = await socialApi.searchUsers(userSearchQuery, 10);
        // Filter out already shared users
        const sharedUserIds = new Set(shares.map(s => s.user_id));
        setUserSearchResults(results.filter(u => !sharedUserIds.has(u.id)));
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, shares]);

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
      setIsGenerateModalOpen(false);
    } catch (err) {
      console.error('Failed to generate grocery list:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Sharing handlers
  const openShareModal = useCallback(async () => {
    setIsShareModalOpen(true);
    setLoadingShares(true);
    try {
      const sharesList = await groceryListApi.listShares();
      setShares(sharesList);
    } catch (err) {
      console.error('Failed to load shares:', err);
    } finally {
      setLoadingShares(false);
    }
  }, []);

  const closeShareModal = useCallback(() => {
    setIsShareModalOpen(false);
    setUserSearchQuery('');
    setUserSearchResults([]);
  }, []);

  const handleShareWithUser = useCallback(async (
    userId: string,
    permission: 'viewer' | 'editor' = 'viewer'
  ) => {
    setSharingUser(userId);
    try {
      const share = await groceryListApi.share({ user_id: userId, permission });
      setShares(prev => [...prev, share]);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch (err) {
      console.error('Failed to share:', err);
      throw err;
    } finally {
      setSharingUser(null);
    }
  }, []);

  const handleUpdatePermission = useCallback(async (
    userId: string,
    permission: 'viewer' | 'editor'
  ) => {
    try {
      const updated = await groceryListApi.updateShare(userId, { permission });
      setShares(prev => prev.map(s => s.user_id === userId ? updated : s));
    } catch (err) {
      console.error('Failed to update permission:', err);
      throw err;
    }
  }, []);

  const handleRemoveShare = useCallback(async (userId: string) => {
    try {
      await groceryListApi.removeShare(userId);
      setShares(prev => prev.filter(s => s.user_id !== userId));
    } catch (err) {
      console.error('Failed to remove share:', err);
      throw err;
    }
  }, []);

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
    isGenerateModalOpen,
    setIsGenerateModalOpen,

    // Sharing
    isShareModalOpen,
    shares,
    loadingShares,
    sharedWithMe,
    userSearchQuery,
    setUserSearchQuery,
    userSearchResults,
    searchingUsers,
    sharingUser,
    openShareModal,
    closeShareModal,
    handleShareWithUser,
    handleUpdatePermission,
    handleRemoveShare,

    // Refresh
    refresh: loadGroceryList,
  };
}
