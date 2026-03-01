'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchApi, mealPlanApi, authApi, ingredientApi, getErrorMessage } from '@/lib/api';
import { useDebouncedSearch } from '@/hooks';
import { formatDateForApi } from '@/lib/calendar-utils';
import { RecipeImage, Modal } from '@/components/ui';
import type { SearchRecipeResult, MealType, MealPlan, Ingredient } from '@/types';

type TabType = 'recipe' | 'custom';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecipe: (recipe: SearchRecipeResult, servings: number) => void;
  onCustomMealSuccess: (meal: MealPlan) => void;
  selectedDate?: Date;
  selectedMealType?: MealType;
  excludeRecipeIds?: Set<string>;
  defaultCalendarId?: string | null;
}

export function AddMealModal({
  isOpen,
  onClose,
  onSelectRecipe,
  onCustomMealSuccess,
  selectedDate,
  selectedMealType = 'dinner',
  excludeRecipeIds = new Set(),
  defaultCalendarId,
}: AddMealModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('recipe');

  // Recipe search state
  const [query, setQuery] = useState('');
  const [suggestedRecipes, setSuggestedRecipes] = useState<SearchRecipeResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [addingRecipe, setAddingRecipe] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Custom meal state
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [servings, setServings] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Ingredient autocomplete state
  const [ingredientSuggestions, setIngredientSuggestions] = useState<Ingredient[]>([]);
  const [showIngredients, setShowIngredients] = useState(false);
  const [ingredientIndex, setIngredientIndex] = useState(-1);
  const ingredientDebounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Load user settings for default servings
  useEffect(() => {
    if (isOpen) {
      authApi.getSettings()
        .then(settings => {
          setServings(settings.default_servings);
        })
        .catch(err => console.error('Failed to fetch user settings:', err));
    }
  }, [isOpen]);

  // Ingredient autocomplete handlers
  const handleCustomTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomTitle(value);
    setIngredientIndex(-1);

    if (ingredientDebounceRef.current) clearTimeout(ingredientDebounceRef.current);

    if (value.length < 2) {
      setIngredientSuggestions([]);
      setShowIngredients(false);
      return;
    }

    ingredientDebounceRef.current = setTimeout(async () => {
      try {
        const results = await ingredientApi.list(value, undefined, 6);
        setIngredientSuggestions(results);
        setShowIngredients(results.length > 0);
      } catch {
        // silently ignore
      }
    }, 250);
  }, []);

  const handleSelectIngredient = useCallback((ingredient: Ingredient) => {
    setCustomTitle(ingredient.name);
    setShowIngredients(false);
    setIngredientSuggestions([]);
    setIngredientIndex(-1);
  }, []);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showIngredients || ingredientSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIngredientIndex(i => Math.min(i + 1, ingredientSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIngredientIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && ingredientIndex >= 0) {
      e.preventDefault();
      handleSelectIngredient(ingredientSuggestions[ingredientIndex]);
    } else if (e.key === 'Escape') {
      setShowIngredients(false);
    }
  }, [showIngredients, ingredientSuggestions, ingredientIndex, handleSelectIngredient]);

  // Handlers
  const handleClose = useCallback(() => {
    setQuery('');
    setSelectedIndex(-1);
    setCustomTitle('');
    setCustomDescription('');
    setError(null);
    setActiveTab('recipe');
    setIngredientSuggestions([]);
    setShowIngredients(false);
    if (ingredientDebounceRef.current) clearTimeout(ingredientDebounceRef.current);
    onClose();
  }, [onClose]);

  const handleSelectRecipe = useCallback((recipe: SearchRecipeResult) => {
    setAddingRecipe(recipe.id);
    try {
      onSelectRecipe(recipe, servings);
      setQuery('');
      setSelectedIndex(-1);
    } finally {
      setAddingRecipe(null);
    }
  }, [onSelectRecipe, servings]);

  const handleCreateRecipe = useCallback(() => {
    const url = query.trim()
      ? `/recipes/new?title=${encodeURIComponent(query.trim())}`
      : '/recipes/new';
    router.push(url);
    handleClose();
  }, [query, router, handleClose]);

  const handleSubmitCustom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customTitle.trim()) {
      setError('Title is required');
      return;
    }

    if (!selectedDate) {
      setError('Date is required');
      return;
    }

    if (!defaultCalendarId) {
      setError('No calendar available');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newMeal = await mealPlanApi.create({
        calendar_id: defaultCalendarId,
        custom_title: customTitle.trim(),
        custom_description: customDescription.trim() || undefined,
        planned_date: formatDateForApi(selectedDate),
        meal_type: selectedMealType,
        servings: servings,
      });
      onCustomMealSuccess(newMeal);
      handleClose();
    } catch (err: unknown) {
      console.error('Failed to create custom meal:', err);
      setError(getErrorMessage(err, 'Failed to create custom meal'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(-1);
      setCustomTitle('');
      setCustomDescription('');
      setError(null);
      // Keep the previously selected tab (don't reset to 'recipe')
    }
  }, [isOpen]);

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

  // Focus input when modal opens or tab changes
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (activeTab === 'recipe') {
          inputRef.current?.focus();
        } else {
          customInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, activeTab]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Keyboard navigation (only for recipe tab)
  useEffect(() => {
    if (!isOpen || activeTab !== 'recipe') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const showCreateOption = query.length >= 2;
      const totalItems = allRecipes.length + (showCreateOption ? 1 : 0);

      if (totalItems === 0) return;

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
        } else if (showCreateOption && (selectedIndex === allRecipes.length || selectedIndex === -1)) {
          handleCreateRecipe();
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, allRecipes, selectedIndex, query, handleSelectRecipe, handleCreateRecipe, handleClose]);

  const dateDisplay = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      position="top"
      blur
      closeOnEscape={activeTab !== 'recipe'}
    >
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header with tabs */}
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-warm-gray">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{dateDisplay} &middot; {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}</span>
            </div>
            <button
              onClick={handleClose}
              className="text-warm-gray hover:text-charcoal transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-4">
            <button
              onClick={() => setActiveTab('recipe')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'recipe'
                  ? 'border-gold text-gold'
                  : 'border-transparent text-warm-gray hover:text-charcoal'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Recipe
              </span>
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'custom'
                  ? 'border-sage text-sage'
                  : 'border-transparent text-warm-gray hover:text-charcoal'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Custom Item
              </span>
            </button>
          </div>
        </div>

        {/* Recipe Tab Content */}
        {activeTab === 'recipe' && (
          <>
            {/* Servings + Search row */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-cream/40">
              <span className="text-xs text-warm-gray">Servings:</span>
              <button
                type="button"
                onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-6 h-6 rounded bg-white border border-border text-charcoal text-sm flex items-center justify-center hover:bg-cream-dark transition-colors"
              >-</button>
              <span className="w-5 text-center text-sm font-medium text-charcoal">{servings}</span>
              <button
                type="button"
                onClick={() => setServings(s => s + 1)}
                className="w-6 h-6 rounded bg-white border border-border text-charcoal text-sm flex items-center justify-center hover:bg-cream-dark transition-colors"
              >+</button>
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
              />
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent" />
              )}
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
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

              {/* Create Recipe Option */}
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
          </>
        )}

        {/* Custom Tab Content */}
        {activeTab === 'custom' && (
          <form onSubmit={handleSubmitCustom} className="p-4 space-y-4">
            {/* Title input with ingredient autocomplete */}
            <div className="relative">
              <label className="block text-sm font-medium text-charcoal mb-1">
                What's on the menu? <span className="text-red-500">*</span>
              </label>
              <input
                ref={customInputRef}
                type="text"
                value={customTitle}
                onChange={handleCustomTitleChange}
                onKeyDown={handleTitleKeyDown}
                onBlur={() => setTimeout(() => setShowIngredients(false), 150)}
                placeholder="e.g., Yogurt, Pear, Pizza Night, Sushi Takeout..."
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-1 focus:ring-sage focus:border-sage outline-none text-sm"
                maxLength={255}
                autoComplete="off"
              />
              {showIngredients && ingredientSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
                  {ingredientSuggestions.map((ingredient, i) => (
                    <li key={ingredient.id}>
                      <button
                        type="button"
                        onMouseDown={() => handleSelectIngredient(ingredient)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-cream transition-colors ${
                          i === ingredientIndex ? 'bg-cream' : ''
                        }`}
                      >
                        <span className="text-charcoal">{ingredient.name}</span>
                        {ingredient.category && (
                          <span className="text-xs text-warm-gray ml-2">{ingredient.category}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Description input */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Notes <span className="text-warm-gray font-normal">(optional)</span>
              </label>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="e.g., Order from Joe's Pizza, call ahead..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-1 focus:ring-sage focus:border-sage outline-none text-sm resize-none"
              />
            </div>

            {/* Servings */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Servings</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setServings(s => Math.max(1, s - 1))}
                  className="w-8 h-8 rounded-lg bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal transition-colors"
                >
                  -
                </button>
                <span className="w-8 text-center text-charcoal font-medium">{servings}</span>
                <button
                  type="button"
                  onClick={() => setServings(s => s + 1)}
                  className="w-8 h-8 rounded-lg bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-warm-gray hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !customTitle.trim()}
                className="px-4 py-2 bg-sage hover:bg-sage/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add to Plan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
