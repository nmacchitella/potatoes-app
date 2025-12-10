'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { searchApi } from '@/lib/api';
import type { SearchResponse } from '@/types';

interface GlobalSearchProps {
  variant?: 'navbar' | 'modal';
  onClose?: () => void;
}

export default function GlobalSearch({ variant = 'navbar', onClose }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // All flattened results for keyboard navigation
  const getAllItems = useCallback(() => {
    if (!results) return [];
    const items: { type: string; item: any; href: string }[] = [];

    results.my_recipes.forEach(r => items.push({ type: 'my_recipe', item: r, href: `/recipes/${r.id}` }));
    results.discover_recipes.forEach(r => items.push({ type: 'discover_recipe', item: r, href: `/recipes/${r.id}` }));
    results.tags.forEach(t => items.push({ type: 'tag', item: t, href: `/search?q=${encodeURIComponent(t.name)}&category=recipes&tag=${t.id}` }));
    results.collections.forEach(c => items.push({ type: 'collection', item: c, href: `/?collection=${c.id}` }));
    results.users.forEach(u => items.push({ type: 'user', item: u, href: `/profile/${u.id}` }));
    results.ingredients.forEach(i => items.push({ type: 'ingredient', item: i, href: `/ingredients/${i.id}` }));

    return items;
  }, [results]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.autocomplete(query, 5);
        setResults(data);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen && !results) return;

      const items = getAllItems();
      const totalItems = items.length + 1; // +1 for "Search all" option

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex === -1 || selectedIndex >= items.length) {
          // Search all
          handleSearchAll();
        } else {
          // Navigate to selected item
          const selected = items[selectedIndex];
          router.push(selected.href);
          handleClose();
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, getAllItems, router]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setResults(null);
    setSelectedIndex(-1);
    onClose?.();
  };

  const handleSearchAll = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      handleClose();
    }
  };

  const handleCreateRecipe = () => {
    if (query.trim()) {
      router.push(`/recipes/new?title=${encodeURIComponent(query.trim())}`);
      handleClose();
    }
  };

  const hasRecipeResults = results && (
    results.my_recipes.length > 0 || results.discover_recipes.length > 0
  );

  const handleFocus = () => {
    setIsOpen(true);
  };

  const hasResults = results && (
    results.my_recipes.length > 0 ||
    results.discover_recipes.length > 0 ||
    results.tags.length > 0 ||
    results.collections.length > 0 ||
    results.users.length > 0 ||
    results.ingredients.length > 0
  );

  const renderResults = () => {
    if (!results) return null;

    const items = getAllItems();
    let currentIndex = 0;

    const renderSection = (
      title: string,
      sectionItems: any[],
      type: string,
      renderItem: (item: any, index: number) => React.ReactNode
    ) => {
      if (sectionItems.length === 0) return null;

      const sectionContent = sectionItems.map((item, i) => {
        const index = currentIndex++;
        return renderItem(item, index);
      });

      return (
        <div key={type} className="py-2">
          <div className="px-3 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
            {title}
          </div>
          {sectionContent}
        </div>
      );
    };

    return (
      <>
        {renderSection('My Recipes', results.my_recipes, 'my_recipe', (item, index) => (
          <Link
            key={item.id}
            href={`/recipes/${item.id}`}
            onClick={handleClose}
            className={`flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors ${
              selectedIndex === index ? 'bg-cream' : ''
            }`}
          >
            <div className="w-10 h-10 rounded bg-cream-dark flex-shrink-0 overflow-hidden">
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal truncate">{item.title}</p>
              {item.description && (
                <p className="text-xs text-warm-gray truncate">{item.description}</p>
              )}
            </div>
          </Link>
        ))}

        {renderSection('Discover', results.discover_recipes, 'discover_recipe', (item, index) => (
          <Link
            key={item.id}
            href={`/recipes/${item.id}`}
            onClick={handleClose}
            className={`flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors ${
              selectedIndex === index ? 'bg-cream' : ''
            }`}
          >
            <div className="w-10 h-10 rounded bg-cream-dark flex-shrink-0 overflow-hidden">
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal truncate">{item.title}</p>
              <p className="text-xs text-warm-gray">by {item.author_name}</p>
            </div>
          </Link>
        ))}

        {renderSection('Ingredients', results.ingredients, 'ingredient', (item, index) => (
          <Link
            key={item.id}
            href={`/ingredients/${item.id}`}
            onClick={handleClose}
            className={`flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors ${
              selectedIndex === index ? 'bg-cream' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal">{item.name}</p>
              <p className="text-xs text-warm-gray">{item.recipe_count} recipes</p>
            </div>
          </Link>
        ))}

        {renderSection('Tags', results.tags, 'tag', (item, index) => (
          <Link
            key={item.id}
            href={`/search?q=${encodeURIComponent(item.name)}&category=recipes&tag=${item.id}`}
            onClick={handleClose}
            className={`flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors ${
              selectedIndex === index ? 'bg-cream' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal">{item.name}</p>
              <p className="text-xs text-warm-gray">{item.recipe_count} recipes</p>
            </div>
          </Link>
        ))}

        {renderSection('Collections', results.collections, 'collection', (item, index) => (
          <Link
            key={item.id}
            href={`/?collection=${item.id}`}
            onClick={handleClose}
            className={`flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors ${
              selectedIndex === index ? 'bg-cream' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal">{item.name}</p>
              <p className="text-xs text-warm-gray">{item.recipe_count} recipes</p>
            </div>
          </Link>
        ))}

        {renderSection('Users', results.users, 'user', (item, index) => (
          <Link
            key={item.id}
            href={`/profile/${item.id}`}
            onClick={handleClose}
            className={`flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors ${
              selectedIndex === index ? 'bg-cream' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0 overflow-hidden">
              {item.profile_image_url ? (
                <img src={item.profile_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-serif text-charcoal">
                  {item.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal">{item.name}</p>
            </div>
          </Link>
        ))}
      </>
    );
  };

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
        <div
          ref={containerRef}
          className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <svg className="w-5 h-5 text-warm-gray flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes, ingredients, users..."
              className="flex-1 bg-transparent text-charcoal placeholder-warm-gray outline-none text-lg"
              autoFocus
            />
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent" />
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-warm-gray bg-cream rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-4 py-8 text-center text-warm-gray">
                <p>Start typing to search...</p>
                <p className="text-xs mt-2">Search recipes, ingredients, tags, collections, and users</p>
              </div>
            ) : !hasResults && !loading ? (
              <div className="px-4 py-8 text-center text-warm-gray">
                <p>No results found for "{query}"</p>
              </div>
            ) : (
              renderResults()
            )}

            {/* Search All Option */}
            {query.length >= 2 && (
              <div className="border-t border-border">
                <button
                  onClick={handleSearchAll}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream transition-colors ${
                    selectedIndex >= getAllItems().length ? 'bg-cream' : ''
                  }`}
                >
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-sm text-charcoal">
                    Search all results for "<span className="font-medium">{query}</span>"
                  </span>
                  <svg className="w-4 h-4 text-warm-gray ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={handleCreateRecipe}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream transition-colors border-t border-border"
                >
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-charcoal">
                    Create recipe "<span className="font-medium">{query}</span>"
                  </span>
                  <svg className="w-4 h-4 text-warm-gray ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Navbar variant
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder="Search..."
          className="w-48 lg:w-64 pl-9 pr-8 py-2 bg-white border border-border rounded-lg text-sm text-charcoal placeholder-warm-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] text-warm-gray bg-cream rounded">
          ⌘K
        </kbd>
      </div>

      {/* Dropdown Results */}
      {isOpen && (query.length >= 2 || hasResults) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-lg shadow-lg overflow-hidden z-50 w-80 lg:w-96">
          <div className="max-h-96 overflow-y-auto">
            {loading && query.length >= 2 && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent" />
              </div>
            )}

            {!loading && query.length >= 2 && !hasResults && (
              <div className="px-4 py-6 text-center text-warm-gray text-sm">
                No results found
              </div>
            )}

            {!loading && hasResults && renderResults()}

            {/* Search All */}
            {query.length >= 2 && (
              <div className="border-t border-border">
                <button
                  onClick={handleSearchAll}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-cream transition-colors text-sm ${
                    selectedIndex >= getAllItems().length ? 'bg-cream' : ''
                  }`}
                >
                  <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-charcoal">Search all for "{query}"</span>
                </button>
                <button
                  onClick={handleCreateRecipe}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-cream transition-colors text-sm border-t border-border"
                >
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-charcoal">Create recipe "{query}"</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Command palette wrapper
export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return <GlobalSearch variant="modal" onClose={() => setIsOpen(false)} />;
}
