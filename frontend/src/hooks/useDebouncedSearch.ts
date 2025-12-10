import { useState, useEffect, useRef } from 'react';
import { searchApi } from '@/lib/api';
import type { SearchResponse } from '@/types';

interface UseDebouncedSearchOptions {
  minLength?: number;
  delay?: number;
  limit?: number;
}

interface UseDebouncedSearchReturn {
  results: SearchResponse | null;
  loading: boolean;
  hasResults: boolean;
}

/**
 * Hook for debounced search with autocomplete
 */
export function useDebouncedSearch(
  query: string,
  options: UseDebouncedSearchOptions = {}
): UseDebouncedSearchReturn {
  const { minLength = 2, delay = 200, limit = 5 } = options;

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < minLength) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.autocomplete(query, limit);
        setResults(data);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, minLength, delay, limit]);

  const hasResults = Boolean(
    results && (
      results.my_recipes.length > 0 ||
      results.discover_recipes.length > 0 ||
      results.tags.length > 0 ||
      results.collections.length > 0 ||
      (results.users?.length ?? 0) > 0 ||
      (results.ingredients?.length ?? 0) > 0
    )
  );

  return { results, loading, hasResults };
}
