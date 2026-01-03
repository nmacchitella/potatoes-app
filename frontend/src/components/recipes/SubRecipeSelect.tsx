'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { recipeApi } from '@/lib/api';
import { useClickOutside } from '@/hooks';
import type { RecipeSummary, SubRecipeInput } from '@/types';

interface SubRecipeSelectProps {
  selectedSubRecipes: SubRecipeInput[];
  onChange: (subRecipes: SubRecipeInput[]) => void;
  excludeRecipeId?: string; // Exclude current recipe from selection
  compact?: boolean;
}

export function SubRecipeSelect({
  selectedSubRecipes,
  onChange,
  excludeRecipeId,
  compact = false,
}: SubRecipeSelectProps) {
  const [availableRecipes, setAvailableRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, useCallback(() => setShowPicker(false), []), showPicker);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        // Fetch user's own recipes
        const data = await recipeApi.list({ page_size: 100, status: 'published' });
        // Filter out the current recipe and recipes that already have sub-recipes (one level only)
        const filtered = data.items.filter(r => r.id !== excludeRecipeId);
        setAvailableRecipes(filtered);
      } catch (error) {
        console.error('Failed to fetch recipes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecipes();
  }, [excludeRecipeId]);

  const addSubRecipe = (recipe: RecipeSummary) => {
    if (selectedSubRecipes.some(s => s.sub_recipe_id === recipe.id)) return;

    onChange([
      ...selectedSubRecipes,
      {
        sub_recipe_id: recipe.id,
        sort_order: selectedSubRecipes.length,
        scale_factor: 1,
        section_title: undefined,
      },
    ]);
  };

  const removeSubRecipe = (subRecipeId: string) => {
    onChange(
      selectedSubRecipes
        .filter(s => s.sub_recipe_id !== subRecipeId)
        .map((s, idx) => ({ ...s, sort_order: idx }))
    );
  };

  const updateScaleFactor = (subRecipeId: string, scaleFactor: number) => {
    onChange(
      selectedSubRecipes.map(s =>
        s.sub_recipe_id === subRecipeId
          ? { ...s, scale_factor: Math.max(0.1, scaleFactor) }
          : s
      )
    );
  };

  const getRecipeTitle = (subRecipeId: string): string => {
    const recipe = availableRecipes.find(r => r.id === subRecipeId);
    return recipe?.title || 'Unknown recipe';
  };

  const filteredRecipes = availableRecipes.filter(
    r =>
      !selectedSubRecipes.some(s => s.sub_recipe_id === r.id) &&
      r.title.toLowerCase().includes(search.toLowerCase())
  );

  if (compact) {
    return (
      <div className="relative" ref={containerRef}>
        {/* Selected sub-recipes */}
        <div className="space-y-2 mb-2">
          {selectedSubRecipes.map(subRecipe => (
            <div
              key={subRecipe.sub_recipe_id}
              className="flex items-center justify-between bg-cream rounded p-2"
            >
              <span className="text-sm text-charcoal truncate flex-1">
                {getRecipeTitle(subRecipe.sub_recipe_id)}
              </span>
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => updateScaleFactor(subRecipe.sub_recipe_id, (subRecipe.scale_factor || 1) - 0.5)}
                  className="w-5 h-5 rounded bg-white hover:bg-cream-dark flex items-center justify-center text-charcoal text-xs"
                >
                  −
                </button>
                <span className="text-xs text-charcoal w-6 text-center">
                  {subRecipe.scale_factor || 1}x
                </span>
                <button
                  onClick={() => updateScaleFactor(subRecipe.sub_recipe_id, (subRecipe.scale_factor || 1) + 0.5)}
                  className="w-5 h-5 rounded bg-white hover:bg-cream-dark flex items-center justify-center text-charcoal text-xs"
                >
                  +
                </button>
                <button
                  onClick={() => removeSubRecipe(subRecipe.sub_recipe_id)}
                  className="text-warm-gray hover:text-red-500 text-sm ml-1"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-full text-left text-xs text-gold hover:text-gold-dark py-1"
        >
          + Add sub-recipe
        </button>

        {/* Picker dropdown */}
        {showPicker && (
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search your recipes..."
                className="w-full text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-xs text-warm-gray text-center">Loading...</div>
              ) : filteredRecipes.length === 0 ? (
                <div className="p-3 text-xs text-warm-gray text-center">
                  {search ? 'No recipes found' : 'No available recipes'}
                </div>
              ) : (
                filteredRecipes.map(recipe => (
                  <button
                    key={recipe.id}
                    onClick={() => {
                      addSubRecipe(recipe);
                      setSearch('');
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-cream transition-colors text-charcoal flex items-center gap-2"
                  >
                    {recipe.cover_image_url && (
                      <img
                        src={recipe.cover_image_url}
                        alt=""
                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <span className="truncate">{recipe.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full editing style
  return (
    <div ref={containerRef}>
      {/* Selected sub-recipes */}
      {selectedSubRecipes.length > 0 && (
        <div className="space-y-3 mb-4">
          {selectedSubRecipes.map(subRecipe => (
            <div
              key={subRecipe.sub_recipe_id}
              className="flex items-center justify-between bg-cream rounded-lg p-3"
            >
              <span className="text-sm text-charcoal font-medium truncate flex-1">
                {getRecipeTitle(subRecipe.sub_recipe_id)}
              </span>
              <div className="flex items-center gap-3 ml-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateScaleFactor(subRecipe.sub_recipe_id, (subRecipe.scale_factor || 1) - 0.5)}
                    className="w-6 h-6 rounded bg-white hover:bg-cream-dark flex items-center justify-center text-charcoal text-sm transition-colors"
                  >
                    −
                  </button>
                  <span className="text-sm text-charcoal w-8 text-center">
                    {subRecipe.scale_factor || 1}x
                  </span>
                  <button
                    type="button"
                    onClick={() => updateScaleFactor(subRecipe.sub_recipe_id, (subRecipe.scale_factor || 1) + 0.5)}
                    className="w-6 h-6 rounded bg-white hover:bg-cream-dark flex items-center justify-center text-charcoal text-sm transition-colors"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeSubRecipe(subRecipe.sub_recipe_id)}
                  className="text-warm-gray hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search and add */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setShowPicker(true);
          }}
          onFocus={() => setShowPicker(true)}
          placeholder="Search your recipes to add as components..."
          className="input-field w-full"
        />

        {showPicker && (
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-warm-gray text-center">Loading recipes...</div>
            ) : filteredRecipes.length === 0 ? (
              <div className="p-4 text-sm text-warm-gray text-center">
                {search ? 'No recipes found' : 'No available recipes to add'}
              </div>
            ) : (
              filteredRecipes.slice(0, 10).map(recipe => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => {
                    addSubRecipe(recipe);
                    setSearch('');
                    setShowPicker(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-cream transition-colors text-charcoal flex items-center gap-3"
                >
                  {recipe.cover_image_url ? (
                    <img
                      src={recipe.cover_image_url}
                      alt=""
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-cream-dark flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{recipe.title}</div>
                    {recipe.description && (
                      <div className="text-xs text-warm-gray truncate">{recipe.description}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
