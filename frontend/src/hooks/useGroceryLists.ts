import { useState, useEffect, useCallback } from 'react';
import { groceryListApi } from '@/lib/api';
import type { GroceryListSummary, SharedGroceryListAccess } from '@/types';

interface UseGroceryListsReturn {
  myLists: GroceryListSummary[];
  setMyLists: React.Dispatch<React.SetStateAction<GroceryListSummary[]>>;
  sharedWithMe: SharedGroceryListAccess[];
  setSharedWithMe: React.Dispatch<React.SetStateAction<SharedGroceryListAccess[]>>;
  loadingLists: boolean;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  loadLists: () => Promise<void>;
  createList: (name?: string) => Promise<GroceryListSummary>;
  renameList: (listId: string, name: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
}

/**
 * Manages the sidebar list of grocery lists — CRUD and selection state.
 * Pair with useGroceryListData for the selected list's content.
 */
export function useGroceryLists(): UseGroceryListsReturn {
  const [myLists, setMyLists] = useState<GroceryListSummary[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedGroceryListAccess[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [lists, shared] = await Promise.all([
        groceryListApi.list(),
        groceryListApi.listSharedWithMe(),
      ]);
      setMyLists(lists);
      setSharedWithMe(shared);
      setSelectedListId(current => {
        if (!current && lists.length > 0) return lists[0].id;
        return current;
      });
    } catch (err) {
      console.error('Failed to load grocery lists:', err);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const createList = useCallback(async (name?: string): Promise<GroceryListSummary> => {
    const newList = await groceryListApi.create(name ? { name } : undefined);
    setMyLists(prev => [newList, ...prev]);
    setSelectedListId(newList.id);
    return newList;
  }, []);

  const renameList = useCallback(async (listId: string, name: string) => {
    const updated = await groceryListApi.update(listId, { name });
    setMyLists(prev => prev.map(l => l.id === listId ? updated : l));
  }, []);

  const deleteList = useCallback(async (listId: string) => {
    await groceryListApi.delete(listId);
    setMyLists(prev => {
      const remaining = prev.filter(l => l.id !== listId);
      if (selectedListId === listId) {
        setSelectedListId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  }, [selectedListId]);

  return {
    myLists,
    setMyLists,
    sharedWithMe,
    setSharedWithMe,
    loadingLists,
    selectedListId,
    setSelectedListId,
    loadLists,
    createList,
    renameList,
    deleteList,
  };
}
