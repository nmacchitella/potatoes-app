import { useState, useEffect, useCallback } from 'react';
import type { Tag } from '@/types';
import { tagApi } from '@/lib/api';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async (category?: string, search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await tagApi.list(category, search);
      setTags(data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      setError('Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const refresh = useCallback(() => {
    fetchTags();
  }, [fetchTags]);

  // Group tags by category
  const tagsByCategory = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
    const category = tag.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tag);
    return acc;
  }, {});

  return {
    tags,
    tagsByCategory,
    loading,
    error,
    refresh,
  };
}
