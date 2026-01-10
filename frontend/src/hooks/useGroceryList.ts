import { useState, useEffect, useCallback } from 'react';
import { groceryListApi, socialApi } from '@/lib/api';
import type {
  GroceryList, GroceryListSummary, GroceryListShare,
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
  // Lists management
  myLists: GroceryListSummary[];
  sharedWithMe: SharedGroceryListAccess[];
  loadingLists: boolean;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  createList: (name?: string) => Promise<GroceryListSummary>;
  renameList: (listId: string, name: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;

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
  generateFromMealPlan: (startDate: string, endDate: string, merge: boolean) => Promise<void>;
  isGenerateModalOpen: boolean;
  setIsGenerateModalOpen: (open: boolean) => void;

  // User sharing
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
  // Lists state
  const [myLists, setMyLists] = useState<GroceryListSummary[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedGroceryListAccess[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Selected list data
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // Sharing state
  const [shares, setShares] = useState<GroceryListShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sharingUser, setSharingUser] = useState<string | null>(null);

  // Load all lists on mount
  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [lists, shared] = await Promise.all([
        groceryListApi.list(),
        groceryListApi.listSharedWithMe(),
      ]);
      setMyLists(lists);
      setSharedWithMe(shared);

      // Auto-select first list if none selected and lists exist
      // Use functional update to avoid stale closure
      setSelectedListId(current => {
        if (!current && lists.length > 0) {
          return lists[0].id;
        }
        return current;
      });
    } catch (err) {
      console.error('Failed to load grocery lists:', err);
      setError('Failed to load grocery lists');
    } finally {
      setLoadingLists(false);
    }
  }, []); // No dependencies - uses functional state updates

  useEffect(() => {
    loadLists();
  }, [loadLists]);

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

  // Create new list
  const createList = useCallback(async (name?: string): Promise<GroceryListSummary> => {
    try {
      const newList = await groceryListApi.create(name ? { name } : undefined);
      setMyLists(prev => [newList, ...prev]);
      setSelectedListId(newList.id);
      setError(null);
      return newList;
    } catch (err) {
      console.error('Failed to create grocery list:', err);
      setError('Failed to create grocery list');
      throw err; // Re-throw so caller can handle it
    }
  }, []);

  // Rename list
  const renameList = useCallback(async (listId: string, name: string) => {
    try {
      const updated = await groceryListApi.update(listId, { name });
      setMyLists(prev => prev.map(l => l.id === listId ? updated : l));
      if (groceryList && groceryList.id === listId) {
        setGroceryList(prev => prev ? { ...prev, name } : null);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to rename grocery list:', err);
      setError('Failed to rename grocery list');
      throw err;
    }
  }, [groceryList]);

  // Delete list
  const deleteList = useCallback(async (listId: string) => {
    try {
      await groceryListApi.delete(listId);
      setMyLists(prev => {
        const remaining = prev.filter(l => l.id !== listId);
        // Select another list or null if we deleted the selected one
        if (selectedListId === listId) {
          setSelectedListId(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
      setError(null);
    } catch (err) {
      console.error('Failed to delete grocery list:', err);
      setError('Failed to delete grocery list');
      throw err;
    }
  }, [selectedListId]);

  // Toggle item checked
  const toggleItemChecked = useCallback(async (itemId: string) => {
    if (!groceryList || !selectedListId) return;

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
      await groceryListApi.updateItem(selectedListId, itemId, { is_checked: !item.is_checked });
    } catch (err) {
      console.error('Failed to update item:', err);
      loadGroceryList();
    }
  }, [groceryList, selectedListId, loadGroceryList]);

  // Toggle item staple status
  const toggleItemStaple = useCallback(async (itemId: string, isStaple: boolean) => {
    if (!groceryList || !selectedListId) return;

    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    const oldCategory = item.category || 'pantry';
    const newCategory = isStaple ? 'staples' : (oldCategory === 'staples' ? 'pantry' : oldCategory);

    // Optimistic update
    setGroceryList(prev => {
      if (!prev) return prev;

      const updatedItem = { ...item, is_staple: isStaple, category: newCategory };
      const newItemsByCategory = { ...prev.items_by_category };

      if (newItemsByCategory[oldCategory]) {
        newItemsByCategory[oldCategory] = newItemsByCategory[oldCategory].filter(i => i.id !== itemId);
      }

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
      await groceryListApi.updateItem(selectedListId, itemId, { is_staple: isStaple, category: newCategory });
    } catch (err) {
      console.error('Failed to update item:', err);
      loadGroceryList();
    }
  }, [groceryList, selectedListId, loadGroceryList]);

  // Add item
  const addItem = useCallback(async (data: GroceryListItemCreateInput) => {
    if (!selectedListId) throw new Error('No list selected');

    const newItem = await groceryListApi.addItem(selectedListId, data);
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

    // Update item count in list summary
    setMyLists(prev => prev.map(l =>
      l.id === selectedListId ? { ...l, item_count: l.item_count + 1 } : l
    ));
  }, [selectedListId]);

  // Delete item
  const deleteItem = useCallback(async (itemId: string) => {
    if (!groceryList || !selectedListId) return;

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

    // Update item count
    setMyLists(prev => prev.map(l =>
      l.id === selectedListId ? { ...l, item_count: Math.max(0, l.item_count - 1) } : l
    ));

    try {
      await groceryListApi.deleteItem(selectedListId, itemId);
    } catch (err) {
      console.error('Failed to delete item:', err);
      loadGroceryList();
    }
  }, [groceryList, selectedListId, loadGroceryList]);

  // Change item category
  const changeItemCategory = useCallback(async (itemId: string, newCategory: string) => {
    if (!groceryList || !selectedListId) return;

    const item = groceryList.items.find(i => i.id === itemId);
    if (!item) return;

    const oldCategory = item.category || 'pantry';

    // Optimistic update - move item to new category
    setGroceryList(prev => {
      if (!prev) return prev;

      const updatedItem = { ...item, category: newCategory };

      // Remove from old category
      const oldCategoryItems = (prev.items_by_category[oldCategory] || []).filter(i => i.id !== itemId);

      // Add to new category
      const newCategoryItems = [...(prev.items_by_category[newCategory] || []), updatedItem];

      return {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updatedItem : i),
        items_by_category: {
          ...prev.items_by_category,
          [oldCategory]: oldCategoryItems,
          [newCategory]: newCategoryItems,
        },
      };
    });

    try {
      await groceryListApi.updateItem(selectedListId, itemId, { category: newCategory });
    } catch (err) {
      console.error('Failed to change item category:', err);
      loadGroceryList(); // Reload to restore original state
      throw err;
    }
  }, [groceryList, selectedListId, loadGroceryList]);

  // Clear checked items
  const clearCheckedItems = useCallback(async () => {
    if (!selectedListId) return;
    await groceryListApi.clear(selectedListId, true);
    await loadGroceryList();
    await loadLists();
  }, [selectedListId, loadGroceryList, loadLists]);

  // Clear all items
  const clearAllItems = useCallback(async () => {
    if (!selectedListId) return;
    await groceryListApi.clear(selectedListId, false);
    await loadGroceryList();
    await loadLists();
  }, [selectedListId, loadGroceryList, loadLists]);

  // Generate from meal plan
  const generateFromMealPlan = useCallback(async (
    startDate: string,
    endDate: string,
    merge: boolean
  ) => {
    if (!selectedListId) throw new Error('No list selected');

    setIsGenerating(true);
    try {
      const list = await groceryListApi.generate(selectedListId, {
        start_date: startDate,
        end_date: endDate,
        merge,
      });
      setGroceryList(list);
      setIsGenerateModalOpen(false);
      await loadLists();
    } catch (err) {
      console.error('Failed to generate grocery list:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [selectedListId, loadLists]);

  // Share with user
  const handleShareWithUser = useCallback(async (userId: string) => {
    if (!selectedListId) return;

    setSharingUser(userId);
    try {
      const share = await groceryListApi.share(selectedListId, { user_id: userId });
      setShares(prev => [...prev, share]);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch (err) {
      console.error('Failed to share:', err);
      throw err;
    } finally {
      setSharingUser(null);
    }
  }, [selectedListId]);

  // Remove share
  const handleRemoveShare = useCallback(async (userId: string) => {
    if (!selectedListId) return;

    await groceryListApi.removeShare(selectedListId, userId);
    setShares(prev => prev.filter(s => s.user_id !== userId));
  }, [selectedListId]);

  // Accept share invitation
  const acceptShare = useCallback(async (shareId: string) => {
    await groceryListApi.acceptShare(shareId);
    setSharedWithMe(prev => prev.map(s =>
      s.id === shareId ? { ...s, status: 'accepted' as const } : s
    ));
  }, []);

  // Decline share invitation
  const declineShare = useCallback(async (shareId: string) => {
    await groceryListApi.declineShare(shareId);
    setSharedWithMe(prev => prev.filter(s => s.id !== shareId));
  }, []);

  // Leave shared list
  const leaveSharedList = useCallback(async (shareId: string) => {
    await groceryListApi.leaveSharedList(shareId);
    setSharedWithMe(prev => prev.filter(s => s.id !== shareId));
    if (selectedListId) {
      const share = sharedWithMe.find(s => s.id === shareId);
      if (share && share.grocery_list_id === selectedListId) {
        setSelectedListId(null);
      }
    }
  }, [selectedListId, sharedWithMe]);

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

    // User sharing
    shares,
    loadingShares,
    userSearchQuery,
    setUserSearchQuery,
    userSearchResults,
    searchingUsers,
    sharingUser,
    handleShareWithUser,
    handleRemoveShare,
    acceptShare,
    declineShare,
    leaveSharedList,

    // Refresh
    refresh: loadGroceryList,
    refreshLists: loadLists,
  };
}
