'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ingredientApi, getErrorMessage } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MainNavigation from '@/components/layout/MainNavigation';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { Ingredient } from '@/types';

const CATEGORY_OPTIONS = [
  { value: 'produce', label: 'Produce' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'meat', label: 'Meat & Seafood' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'spices', label: 'Spices & Seasonings' },
  { value: 'condiments', label: 'Condiments' },
  { value: 'grains', label: 'Grains & Pasta' },
  { value: 'canned', label: 'Canned Goods' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'oils', label: 'Oils & Vinegars' },
  { value: 'baking', label: 'Baking' },
  { value: 'nuts', label: 'Nuts & Seeds' },
  { value: 'deli', label: 'Deli' },
  { value: 'international', label: 'International' },
  { value: 'health', label: 'Health Foods' },
  { value: 'other', label: 'Other' },
];

const getCategoryLabel = (value: string) => {
  const option = CATEGORY_OPTIONS.find(o => o.value === value);
  return option?.label || value;
};

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ingredientApi.list(
        searchQuery || undefined,
        selectedCategory || undefined,
        200
      );
      setIngredients(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load ingredients'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadIngredients();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadIngredients]);

  const handleEditCategory = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditingCategory(ingredient.category || 'other');
  };

  const handleSaveCategory = async (ingredientId: string) => {
    setSavingId(ingredientId);
    try {
      const updated = await ingredientApi.update(ingredientId, { category: editingCategory });
      setIngredients(prev => prev.map(ing =>
        ing.id === ingredientId ? { ...ing, category: updated.category } : ing
      ));
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update category:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingCategory('');
  };

  // Group ingredients by category
  const groupedIngredients = ingredients.reduce((acc, ing) => {
    const cat = ing.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ing);
    return acc;
  }, {} as Record<string, Ingredient[]>);

  // Sort categories
  const sortedCategories = Object.keys(groupedIngredients).sort((a, b) => {
    const aIndex = CATEGORY_OPTIONS.findIndex(o => o.value === a);
    const bIndex = CATEGORY_OPTIONS.findIndex(o => o.value === b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <MainNavigation currentPage="ingredients" />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-serif text-charcoal">Ingredients</h1>
                <p className="text-sm text-warm-gray mt-1">
                  Manage ingredient categories for better grocery list organization
                </p>
              </div>
            </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ingredients..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold bg-white"
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        ) : ingredients.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <svg className="w-12 h-12 text-warm-gray mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h3 className="text-lg font-medium text-charcoal mb-2">No ingredients found</h3>
            <p className="text-warm-gray">
              {searchQuery || selectedCategory
                ? 'Try adjusting your search or filter'
                : 'Ingredients will appear here as you add them to recipes'}
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-4 text-sm text-warm-gray">
              {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
              {selectedCategory && ` in ${getCategoryLabel(selectedCategory)}`}
            </div>

            {/* Grouped list */}
            <div className="space-y-6">
              {sortedCategories.map(category => (
                <div key={category} className="bg-white rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 bg-cream/50 border-b border-border">
                    <h2 className="font-medium text-charcoal">
                      {getCategoryLabel(category)}
                      <span className="ml-2 text-sm font-normal text-warm-gray">
                        ({groupedIngredients[category].length})
                      </span>
                    </h2>
                  </div>
                  <div className="divide-y divide-border">
                    {groupedIngredients[category].map(ingredient => (
                      <div
                        key={ingredient.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-cream/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/ingredients/${ingredient.id}`}
                            className="text-charcoal hover:text-gold transition-colors"
                          >
                            <span className="capitalize">{ingredient.name}</span>
                          </Link>
                          {ingredient.is_system && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                              System
                            </span>
                          )}
                        </div>

                        {editingId === ingredient.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editingCategory}
                              onChange={(e) => setEditingCategory(e.target.value)}
                              disabled={savingId === ingredient.id}
                              className="px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-gold/50"
                            >
                              {CATEGORY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSaveCategory(ingredient.id)}
                              disabled={savingId === ingredient.id}
                              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={savingId === ingredient.id}
                              className="p-1 text-warm-gray hover:text-charcoal"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditCategory(ingredient)}
                            className="p-1.5 text-warm-gray hover:text-gold transition-colors"
                            title="Change category"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
          </main>
        </div>
      </div>
    </div>
  );
}
