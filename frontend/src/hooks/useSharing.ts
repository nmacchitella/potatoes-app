import { useState, useEffect, useCallback } from 'react';
import { socialApi } from '@/lib/api';
import type { UserSearchResult } from '@/types';

interface UseShareSearchOptions {
  excludeUserIds?: string[];
}

export function useShareSearch(options: UseShareSearchOptions = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await socialApi.searchUsers(searchQuery, 10);
        const excludeSet = new Set(options.excludeUserIds || []);
        setSearchResults(results.filter(u => !excludeSet.has(u.id)));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, options.excludeUserIds]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    clearSearch,
  };
}
