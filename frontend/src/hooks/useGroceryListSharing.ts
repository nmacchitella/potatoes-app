import { useState, useEffect, useCallback } from 'react';
import { groceryListApi, socialApi } from '@/lib/api';
import type { GroceryListShare, SharedGroceryListAccess, UserSearchResult } from '@/types';

interface UseGroceryListSharingOptions {
  selectedListId: string | null;
  shares: GroceryListShare[];
  setShares: React.Dispatch<React.SetStateAction<GroceryListShare[]>>;
  sharedWithMe: SharedGroceryListAccess[];
  setSharedWithMe: React.Dispatch<React.SetStateAction<SharedGroceryListAccess[]>>;
  setSelectedListId: (id: string | null) => void;
}

interface UseGroceryListSharingReturn {
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
}

/**
 * Manages share operations for the currently selected grocery list.
 * Requires share state from the parent useGroceryList hook.
 */
export function useGroceryListSharing({
  selectedListId,
  shares,
  setShares,
  sharedWithMe,
  setSharedWithMe,
  setSelectedListId,
}: UseGroceryListSharingOptions): UseGroceryListSharingReturn {
  const [loadingShares, setLoadingShares] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sharingUser, setSharingUser] = useState<string | null>(null);

  // Debounced user search for sharing
  useEffect(() => {
    if (!userSearchQuery.trim() || userSearchQuery.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const results = await socialApi.searchUsers(userSearchQuery, 10);
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

  const handleShareWithUser = useCallback(async (userId: string) => {
    if (!selectedListId) return;
    setSharingUser(userId);
    try {
      const share = await groceryListApi.share(selectedListId, { user_id: userId });
      setShares(prev => [...prev, share]);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } finally {
      setSharingUser(null);
    }
  }, [selectedListId, setShares]);

  const handleRemoveShare = useCallback(async (userId: string) => {
    if (!selectedListId) return;
    await groceryListApi.removeShare(selectedListId, userId);
    setShares(prev => prev.filter(s => s.user_id !== userId));
  }, [selectedListId, setShares]);

  const acceptShare = useCallback(async (shareId: string) => {
    await groceryListApi.acceptShare(shareId);
    setSharedWithMe(prev => prev.map(s =>
      s.id === shareId ? { ...s, status: 'accepted' as const } : s
    ));
  }, [setSharedWithMe]);

  const declineShare = useCallback(async (shareId: string) => {
    await groceryListApi.declineShare(shareId);
    setSharedWithMe(prev => prev.filter(s => s.id !== shareId));
  }, [setSharedWithMe]);

  const leaveSharedList = useCallback(async (shareId: string) => {
    await groceryListApi.leaveSharedList(shareId);
    const share = sharedWithMe.find(s => s.id === shareId);
    setSharedWithMe(prev => prev.filter(s => s.id !== shareId));
    if (share && share.grocery_list_id === selectedListId) {
      setSelectedListId(null);
    }
  }, [selectedListId, sharedWithMe, setSharedWithMe, setSelectedListId]);

  return {
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
  };
}
