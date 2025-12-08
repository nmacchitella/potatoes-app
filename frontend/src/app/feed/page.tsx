'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { recipeApi, tagApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { RecipeSummary, Tag } from '@/types';

type CategoryFilter = 'all' | 'recipes' | 'tags';

export default function FeedPage() {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);

  // Data
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Pagination
  const [recipePage, setRecipePage] = useState(1);
  const [hasMoreRecipes, setHasMoreRecipes] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [recipesRes, tagsRes] = await Promise.all([
        recipeApi.getPublicFeed(1, 8),
        tagApi.list(),
      ]);

      setRecipes(recipesRes.items);
      setHasMoreRecipes(recipesRes.page < recipesRes.total_pages);
      setTags(tagsRes.slice(0, 12)); // Show top 12 tags
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreRecipes = async () => {
    const nextPage = recipePage + 1;
    try {
      const response = await recipeApi.getPublicFeed(nextPage, 8);
      setRecipes([...recipes, ...response.items]);
      setHasMoreRecipes(response.page < response.total_pages);
      setRecipePage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  };

  const categories: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'recipes', label: 'Recipes' },
    { key: 'tags', label: 'Tags' },
  ];

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-charcoal">Discover</h1>
          <p className="text-warm-gray mt-2">
            Explore recipes from the community
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                category === cat.key
                  ? 'bg-gold text-white'
                  : 'bg-white border border-border text-charcoal hover:border-gold'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="space-y-8">
            {/* Recipes Section */}
            {(category === 'all' || category === 'recipes') && (
              <section>
                {category === 'all' && recipes.length > 0 && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl text-charcoal">Recipes</h2>
                    <button
                      onClick={() => setCategory('recipes')}
                      className="text-sm text-gold hover:text-gold-dark"
                    >
                      View all
                    </button>
                  </div>
                )}

                {recipes.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
                      <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="font-serif text-xl text-charcoal mb-2">No recipes yet</h3>
                    <p className="text-warm-gray">
                      Be the first to share a recipe!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(category === 'all' ? recipes.slice(0, 4) : recipes).map(recipe => (
                        <Link
                          key={recipe.id}
                          href={`/recipes/${recipe.id}`}
                          className="flex gap-4 p-4 bg-white rounded-lg border border-border hover:border-gold transition-colors group"
                        >
                          <div className="w-20 h-20 rounded bg-cream-dark flex-shrink-0 overflow-hidden">
                            {recipe.cover_image_url ? (
                              <img
                                src={recipe.cover_image_url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-serif text-charcoal group-hover:text-gold transition-colors truncate">
                              {recipe.title}
                            </h3>
                            {recipe.description && (
                              <p className="text-sm text-warm-gray line-clamp-2 mt-1">{recipe.description}</p>
                            )}
                            <p className="text-xs text-warm-gray mt-2">
                              by {recipe.author.name}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>

                    {category === 'recipes' && hasMoreRecipes && (
                      <div className="text-center mt-6">
                        <button
                          onClick={loadMoreRecipes}
                          className="px-6 py-2 bg-white border border-border rounded-full text-sm text-charcoal hover:border-gold transition-colors"
                        >
                          Load more
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* Tags Section */}
            {(category === 'all' || category === 'tags') && tags.length > 0 && (
              <section>
                {category === 'all' && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl text-charcoal">Browse by Tag</h2>
                    <button
                      onClick={() => setCategory('tags')}
                      className="text-sm text-gold hover:text-gold-dark"
                    >
                      View all
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(category === 'all' ? tags.slice(0, 8) : tags).map(tag => (
                    <Link
                      key={tag.id}
                      href={`/recipes?tag=${tag.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-border hover:border-gold transition-colors"
                    >
                      <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-charcoal">{tag.name}</span>
                      {tag.category && (
                        <span className="text-xs text-warm-gray">({tag.category})</span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
