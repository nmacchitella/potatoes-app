'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { searchApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { FullSearchResponse } from '@/types';

type CategoryFilter = 'all' | 'recipes' | 'ingredients' | 'tags' | 'collections' | 'users';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const categoryParam = (searchParams.get('category') as CategoryFilter) || 'all';

  const [results, setResults] = useState<FullSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>(categoryParam);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (query) {
      fetchResults();
    } else {
      setLoading(false);
    }
  }, [query, category, page]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const data = await searchApi.full(
        query,
        page,
        20,
        category === 'all' ? undefined : category
      );
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (newCategory: CategoryFilter) => {
    setCategory(newCategory);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (newCategory === 'all') {
      params.delete('category');
    } else {
      params.set('category', newCategory);
    }
    router.push(`/search?${params.toString()}`);
  };

  const categories: { key: CategoryFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'recipes', label: 'Recipes', count: results?.recipes_total },
    { key: 'ingredients', label: 'Ingredients', count: results?.ingredients_total },
    { key: 'tags', label: 'Tags', count: results?.tags_total },
    { key: 'collections', label: 'Collections', count: results?.collections_total },
    { key: 'users', label: 'Users', count: results?.users_total },
  ];

  const totalResults = results
    ? results.recipes_total + results.ingredients_total + results.tags_total + results.collections_total + results.users_total
    : 0;

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-charcoal">
            Search results for "{query}"
          </h1>
          {!loading && (
            <p className="text-warm-gray mt-2">
              {totalResults} result{totalResults !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                category === cat.key
                  ? 'bg-gold text-white'
                  : 'bg-white border border-border text-charcoal hover:border-gold'
              }`}
            >
              {cat.label}
              {cat.count !== undefined && cat.count > 0 && (
                <span className="ml-1.5 opacity-75">({cat.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        )}

        {/* No Query */}
        {!loading && !query && (
          <div className="text-center py-12">
            <p className="text-warm-gray">Enter a search term to get started</p>
          </div>
        )}

        {/* No Results */}
        {!loading && query && totalResults === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
              <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-serif text-xl text-charcoal mb-2">No results found</h3>
            <p className="text-warm-gray">
              Try different keywords or check your spelling
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && results && (
          <div className="space-y-8">
            {/* Recipes Section */}
            {(category === 'all' || category === 'recipes') && results.recipes.length > 0 && (
              <section>
                {category === 'all' && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl text-charcoal">Recipes</h2>
                    {results.recipes_total > results.recipes.length && (
                      <button
                        onClick={() => handleCategoryChange('recipes')}
                        className="text-sm text-gold hover:text-gold-dark"
                      >
                        View all {results.recipes_total}
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {results.recipes.map(recipe => (
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
                          {recipe.is_own ? 'Your recipe' : `by ${recipe.author_name}`}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Ingredients Section */}
            {(category === 'all' || category === 'ingredients') && results.ingredients.length > 0 && (
              <section>
                {category === 'all' && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl text-charcoal">Ingredients</h2>
                    {results.ingredients_total > results.ingredients.length && (
                      <button
                        onClick={() => handleCategoryChange('ingredients')}
                        className="text-sm text-gold hover:text-gold-dark"
                      >
                        View all {results.ingredients_total}
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {results.ingredients.map(ingredient => (
                    <Link
                      key={ingredient.id}
                      href={`/ingredients/${ingredient.id}`}
                      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-border hover:border-gold transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-charcoal truncate">{ingredient.name}</p>
                        <p className="text-xs text-warm-gray">{ingredient.recipe_count} recipes</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Tags Section */}
            {(category === 'all' || category === 'tags') && results.tags.length > 0 && (
              <section>
                {category === 'all' && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl text-charcoal">Tags</h2>
                    {results.tags_total > results.tags.length && (
                      <button
                        onClick={() => handleCategoryChange('tags')}
                        className="text-sm text-gold hover:text-gold-dark"
                      >
                        View all {results.tags_total}
                      </button>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {results.tags.map(tag => (
                    <Link
                      key={tag.id}
                      href={`/search?q=${encodeURIComponent(tag.name)}&category=recipes&tag=${tag.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-border hover:border-gold transition-colors"
                    >
                      <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-charcoal">{tag.name}</span>
                      <span className="text-xs text-warm-gray">({tag.recipe_count})</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Collections Section */}
            {(category === 'all' || category === 'collections') && results.collections.length > 0 && (
              <section>
                {category === 'all' && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl text-charcoal">Collections</h2>
                    {results.collections_total > results.collections.length && (
                      <button
                        onClick={() => handleCategoryChange('collections')}
                        className="text-sm text-gold hover:text-gold-dark"
                      >
                        View all {results.collections_total}
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.collections.map(collection => (
                    <Link
                      key={collection.id}
                      href={`/collections/${collection.id}`}
                      className="flex items-center gap-3 p-4 bg-white rounded-lg border border-border hover:border-gold transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-charcoal truncate">{collection.name}</p>
                        {collection.description && (
                          <p className="text-sm text-warm-gray truncate">{collection.description}</p>
                        )}
                        <p className="text-xs text-warm-gray mt-1">{collection.recipe_count} recipes</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Users Section */}
            {(category === 'all' || category === 'users') && results.users.length > 0 && (
              <section>
                {category === 'all' && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl text-charcoal">Users</h2>
                    {results.users_total > results.users.length && (
                      <button
                        onClick={() => handleCategoryChange('users')}
                        className="text-sm text-gold hover:text-gold-dark"
                      >
                        View all {results.users_total}
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.users.map(user => (
                    <Link
                      key={user.id}
                      href={`/users/${user.username || user.id}`}
                      className="flex items-center gap-3 p-4 bg-white rounded-lg border border-border hover:border-gold transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {user.profile_image_url ? (
                          <img src={user.profile_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-serif text-charcoal">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-charcoal truncate">{user.name}</p>
                        {user.username && (
                          <p className="text-sm text-warm-gray">@{user.username}</p>
                        )}
                      </div>
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

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
