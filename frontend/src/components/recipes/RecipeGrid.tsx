'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { RecipeSummary } from '@/types';

type SortColumn = 'name' | 'time' | 'servings' | 'collections';
type SortDirection = 'asc' | 'desc';

interface RecipeGridProps {
  recipes: RecipeSummary[];
  loading: boolean;
  emptyState: {
    hasFilters: boolean;
    hasCollection: boolean;
    onClearFilters: () => void;
  };
  manageMode?: {
    enabled: boolean;
    selectedCollection: string | null;
    savingRecipeId: string | null;
    onRemoveRecipe: (recipeId: string, recipeName: string) => void;
  };
  viewMode?: 'grid' | 'table';
}

export default function RecipeGrid({
  recipes,
  loading,
  emptyState,
  manageMode,
  viewMode = 'grid',
}: RecipeGridProps) {
  if (loading) {
    if (viewMode === 'table') {
      return (
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-cream-dark rounded" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-cream-dark/50 rounded" />
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-2 sm:mb-3" />
            <div className="h-3 sm:h-4 bg-cream-dark rounded w-3/4 mb-1 sm:mb-2" />
            <div className="h-2 sm:h-3 bg-cream-dark rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
          <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="font-serif text-xl text-charcoal mb-2">
          {emptyState.hasFilters
            ? 'No recipes match your filters'
            : emptyState.hasCollection
            ? 'No recipes in this collection'
            : 'No recipes yet'}
        </h3>
        <p className="text-warm-gray mb-6">
          {emptyState.hasFilters
            ? 'Try adjusting your search or clearing filters'
            : emptyState.hasCollection
            ? 'Add some recipes to this collection to see them here'
            : 'Create your first recipe to get started'
          }
        </p>
        {emptyState.hasFilters ? (
          <button
            onClick={emptyState.onClearFilters}
            className="btn-secondary"
          >
            Clear Filters
          </button>
        ) : !emptyState.hasCollection && (
          <Link href="/recipes/new" className="btn-primary">
            + New Recipe
          </Link>
        )}
      </div>
    );
  }

  const isManaging = manageMode?.enabled && manageMode?.selectedCollection;

  // Sorting state for table view
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedRecipes = useMemo(() => {
    if (viewMode !== 'table') return recipes;

    return [...recipes].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'time':
          const timeA = (a.prep_time_minutes || 0) + (a.cook_time_minutes || 0);
          const timeB = (b.prep_time_minutes || 0) + (b.cook_time_minutes || 0);
          comparison = timeA - timeB;
          break;
        case 'servings':
          comparison = (a.yield_quantity || 0) - (b.yield_quantity || 0);
          break;
        case 'collections':
          // Sort alphabetically by first collection name, recipes with no collections go last
          const collNameA = a.collections?.[0]?.name || '';
          const collNameB = b.collections?.[0]?.name || '';
          if (!collNameA && !collNameB) comparison = 0;
          else if (!collNameA) comparison = 1;
          else if (!collNameB) comparison = -1;
          else comparison = collNameA.localeCompare(collNameB);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [recipes, sortColumn, sortDirection, viewMode]);

  // Track which recipes have expanded collections
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  const toggleExpandCollections = (recipeId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-3.5 h-3.5 text-warm-gray/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Table View
  if (viewMode === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1.5 text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
                >
                  Recipe Name
                  <SortIcon column="name" />
                </button>
              </th>
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('time')}
                  className="flex items-center gap-1.5 text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
                >
                  Time
                  <SortIcon column="time" />
                </button>
              </th>
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('servings')}
                  className="flex items-center gap-1.5 text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
                >
                  Servings
                  <SortIcon column="servings" />
                </button>
              </th>
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('collections')}
                  className="flex items-center gap-1.5 text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
                >
                  Collections
                  <SortIcon column="collections" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRecipes.map(recipe => {
              const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
              const collections = recipe.collections || [];
              const isExpanded = expandedCollections.has(recipe.id);

              return (
                <tr key={recipe.id} className="border-b border-border/50 hover:bg-cream-dark/30 transition-colors">
                  <td className="py-3 px-4">
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="text-charcoal hover:text-gold transition-colors font-medium"
                    >
                      {recipe.title}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm text-warm-gray">
                    {totalTime > 0 ? `${totalTime} min` : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm text-warm-gray">
                    {recipe.yield_quantity ? `${recipe.yield_quantity} ${recipe.yield_unit || 'servings'}` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {collections.length === 0 ? (
                      <span className="text-sm text-warm-gray">—</span>
                    ) : collections.length === 1 ? (
                      <span className="text-sm text-charcoal">{collections[0].name}</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {isExpanded ? (
                          <>
                            {collections.map(col => (
                              <span key={col.id} className="text-sm text-charcoal">
                                {col.name}
                              </span>
                            ))}
                            <button
                              onClick={() => toggleExpandCollections(recipe.id)}
                              className="text-xs text-gold hover:text-gold-dark transition-colors text-left"
                            >
                              Show less
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-charcoal">{collections[0].name}</span>
                            <button
                              onClick={() => toggleExpandCollections(recipe.id)}
                              className="text-xs text-gold hover:text-gold-dark transition-colors whitespace-nowrap"
                            >
                              +{collections.length - 1} more
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Grid View
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      {recipes.map(recipe => (
        <Link
          key={recipe.id}
          href={`/recipes/${recipe.id}`}
          className="group"
        >
          <div className="aspect-[4/3] rounded-lg overflow-hidden mb-2 sm:mb-3 bg-cream-dark relative">
            {recipe.cover_image_url ? (
              <img
                src={recipe.cover_image_url}
                alt={recipe.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-8 h-8 sm:w-12 sm:h-12 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {/* Remove from Collection Button - shown in manage mode when viewing a collection */}
            {isManaging && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  manageMode.onRemoveRecipe(recipe.id, recipe.title);
                }}
                disabled={manageMode.savingRecipeId === recipe.id}
                className="absolute top-1 right-1 sm:top-2 sm:right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                title="Remove from collection"
              >
                {manageMode.savingRecipeId === recipe.id ? (
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            )}
            {/* Privacy Badge - display only (edit via recipe detail page) */}
            {!isManaging && (
              <span
                className={`absolute top-1 right-1 sm:top-2 sm:right-2 px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-medium ${
                  recipe.privacy_level === 'public'
                    ? 'bg-green-100/90 text-green-700'
                    : 'bg-gray-100/90 text-gray-600'
                }`}
              >
                {recipe.privacy_level === 'public' ? (
                  <span className="flex items-center gap-0.5">
                    <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="hidden sm:inline">Public</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="hidden sm:inline">Private</span>
                  </span>
                )}
              </span>
            )}
          </div>
          <h3 className="font-serif text-sm sm:text-lg text-charcoal group-hover:text-gold transition-colors line-clamp-2">
            {recipe.title}
          </h3>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-warm-gray mt-1">
            {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
              <span>{(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min</span>
            )}
            {recipe.difficulty && (
              <span className={`capitalize ${
                recipe.difficulty === 'easy' ? 'text-green-600' :
                recipe.difficulty === 'medium' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {recipe.difficulty}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
