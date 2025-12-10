'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { searchApi } from '@/lib/api';
import { useDebouncedSearch } from '@/hooks';
import { RecipeImage, Modal } from '@/components/ui';
import type { SearchRecipeResult } from '@/types';

interface RecipeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecipe: (recipe: SearchRecipeResult) => void;
  excludeRecipeIds?: Set<string>;
  title?: string;
}

export default function RecipeSearchModal({
  isOpen,
  onClose,
  onSelectRecipe,
  excludeRecipeIds = new Set(),
  title = 'Add Recipe'
}: RecipeSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestedRecipes, setSuggestedRecipes] = useState<SearchRecipeResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [addingRecipe, setAddingRecipe] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use shared debounced search hook
  const { results, loading } = useDebouncedSearch(query, { limit: 10 });

  // Filter out excluded recipes
  const filteredMyRecipes = (results?.my_recipes || []).filter(r => !excludeRecipeIds.has(r.id));
  const filteredDiscoverRecipes = (results?.discover_recipes || []).filter(r => !excludeRecipeIds.has(r.id));
  const filteredSuggested = suggestedRecipes.filter(r => !excludeRecipeIds.has(r.id));
  const allRecipes = query.length >= 2
    ? [...filteredMyRecipes, ...filteredDiscoverRecipes]
    : filteredSuggested;
  const hasResults = allRecipes.length > 0;

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Load suggestions when modal opens
  useEffect(() => {
    if (isOpen && suggestedRecipes.length === 0) {
      setLoadingSuggestions(true);
      searchApi.autocomplete('', 6)
        .then(data => {
          setSuggestedRecipes(data.my_recipes || []);
        })
        .catch(err => console.error('Failed to load suggestions:', err))
        .finally(() => setLoadingSuggestions(false));
    }
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const totalItems = allRecipes.length + 1; // +1 for "Create recipe" option

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < allRecipes.length) {
          handleSelectRecipe(allRecipes[selectedIndex]);
        } else if (selectedIndex === allRecipes.length || selectedIndex === -1) {
          handleCreateRecipe();
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allRecipes, selectedIndex]);

  const handleClose = () => {
    setQuery('');
    setSelectedIndex(-1);
    onClose();
  };

  const handleSelectRecipe = async (recipe: SearchRecipeResult) => {
    setAddingRecipe(recipe.id);
    try {
      await onSelectRecipe(recipe);
      // Clear search after successfully adding - returns to suggested recipes view
      setQuery('');
      setSelectedIndex(-1);
    } finally {
      setAddingRecipe(null);
    }
  };

  const handleCreateRecipe = () => {
    const url = query.trim()
      ? `/recipes/new?title=${encodeURIComponent(query.trim())}`
      : '/recipes/new';
    router.push(url);
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      position="top"
      blur
      closeOnEscape={false} // We handle escape in keyboard navigation
    >
      <div
        ref={containerRef}
        className="bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-serif text-lg text-charcoal">{title}</h2>
          <button
            onClick={handleClose}
            className="text-warm-gray hover:text-charcoal transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
            placeholder="Search recipes..."
            className="flex-1 bg-transparent text-charcoal placeholder-warm-gray outline-none text-base"
            autoFocus
          />
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 ? (
            loadingSuggestions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gold border-t-transparent" />
              </div>
            ) : filteredSuggested.length > 0 ? (
              <div className="py-2">
                <div className="px-4 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
                  Your Recipes
                </div>
                {filteredSuggested.map((recipe, index) => (
                  <button
                    key={recipe.id}
                    onClick={() => handleSelectRecipe(recipe)}
                    disabled={addingRecipe === recipe.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-cream transition-colors text-left ${
                      selectedIndex === index ? 'bg-cream' : ''
                    } ${addingRecipe === recipe.id ? 'opacity-50' : ''}`}
                  >
                    <RecipeImage src={recipe.cover_image_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal truncate">{recipe.title}</p>
                      {recipe.description && (
                        <p className="text-xs text-warm-gray truncate">{recipe.description}</p>
                      )}
                    </div>
                    {addingRecipe === recipe.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent flex-shrink-0" />
                    ) : (
                      <svg className="w-5 h-5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-warm-gray">
                <p>Start typing to search recipes...</p>
              </div>
            )
          ) : loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gold border-t-transparent" />
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-cream-dark flex items-center justify-center">
                <svg className="w-6 h-6 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-warm-gray mb-4">No recipes found for "{query}"</p>
              <button
                onClick={handleCreateRecipe}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create "{query}"
              </button>
            </div>
          ) : (
            <>
              {/* My Recipes */}
              {filteredMyRecipes.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
                    My Recipes
                  </div>
                  {filteredMyRecipes.map((recipe, index) => (
                    <button
                      key={recipe.id}
                      onClick={() => handleSelectRecipe(recipe)}
                      disabled={addingRecipe === recipe.id}
                      className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-cream transition-colors text-left ${
                        selectedIndex === index ? 'bg-cream' : ''
                      } ${addingRecipe === recipe.id ? 'opacity-50' : ''}`}
                    >
                      <RecipeImage src={recipe.cover_image_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-charcoal truncate">{recipe.title}</p>
                        {recipe.description && (
                          <p className="text-xs text-warm-gray truncate">{recipe.description}</p>
                        )}
                      </div>
                      {addingRecipe === recipe.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent flex-shrink-0" />
                      ) : (
                        <svg className="w-5 h-5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Discover Recipes */}
              {filteredDiscoverRecipes.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
                    Discover
                  </div>
                  {filteredDiscoverRecipes.map((recipe, index) => {
                    const actualIndex = filteredMyRecipes.length + index;
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => handleSelectRecipe(recipe)}
                        disabled={addingRecipe === recipe.id}
                        className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-cream transition-colors text-left ${
                          selectedIndex === actualIndex ? 'bg-cream' : ''
                        } ${addingRecipe === recipe.id ? 'opacity-50' : ''}`}
                      >
                        <RecipeImage src={recipe.cover_image_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-charcoal truncate">{recipe.title}</p>
                          <p className="text-xs text-warm-gray">by {recipe.author_name}</p>
                        </div>
                        {addingRecipe === recipe.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent flex-shrink-0" />
                        ) : (
                          <svg className="w-5 h-5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Create Recipe Option - Always shown when query exists */}
          {query.length >= 2 && (
            <div className="border-t border-border">
              <button
                onClick={handleCreateRecipe}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream transition-colors ${
                  selectedIndex === allRecipes.length ? 'bg-cream' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm text-charcoal">
                    Create new recipe "<span className="font-medium">{query}</span>"
                  </p>
                  <p className="text-xs text-warm-gray">Start from scratch</p>
                </div>
                <svg className="w-4 h-4 text-warm-gray flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
