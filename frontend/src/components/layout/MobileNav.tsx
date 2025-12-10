'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useClickOutside, useDebouncedSearch } from '@/hooks';
import { UserAvatar, RecipeImage } from '@/components/ui';

interface MobileNavProps {
  onMenuClick: () => void;
}

export default function MobileNav({ onMenuClick }: MobileNavProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { results, loading, hasResults } = useDebouncedSearch(query);

  useClickOutside(containerRef, useCallback(() => setIsSearchOpen(false), []));

  const handleClose = () => {
    setIsSearchOpen(false);
    setQuery('');
  };

  const handleSearchAll = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      handleClose();
    }
  };

  const handleResultClick = (href: string) => {
    router.push(href);
    handleClose();
  };

  return (
    <nav className="bg-cream border-b border-border sticky top-0 z-40 md:hidden">
      <div className="px-4">
        <div className="flex items-center justify-between h-14">
          {/* Hamburger Menu */}
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 text-charcoal hover:text-gold transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search */}
          <div ref={containerRef} className="flex-1 mx-3 relative">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-full text-sm text-charcoal placeholder-warm-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gold border-t-transparent" />
                </div>
              )}
            </div>

            {/* Dropdown Results */}
            {isSearchOpen && query.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-lg shadow-lg overflow-hidden z-50">
                <div className="max-h-80 overflow-y-auto">
                  {loading && !hasResults && (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent" />
                    </div>
                  )}

                  {!loading && !hasResults && (
                    <div className="px-4 py-6 text-center text-warm-gray text-sm">
                      No results found
                    </div>
                  )}

                  {hasResults && results && (
                    <>
                      {results.my_recipes.length > 0 && (
                        <div className="py-2">
                          <div className="px-3 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
                            My Recipes
                          </div>
                          {results.my_recipes.slice(0, 3).map(item => (
                            <button
                              key={item.id}
                              onClick={() => handleResultClick(`/recipes/${item.id}`)}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors w-full text-left"
                            >
                              <RecipeImage src={item.cover_image_url} size="sm" />
                              <span className="text-sm text-charcoal truncate">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {results.discover_recipes.length > 0 && (
                        <div className="py-2 border-t border-border">
                          <div className="px-3 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
                            Discover
                          </div>
                          {results.discover_recipes.slice(0, 3).map(item => (
                            <button
                              key={item.id}
                              onClick={() => handleResultClick(`/recipes/${item.id}`)}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors w-full text-left"
                            >
                              <RecipeImage src={item.cover_image_url} size="sm" />
                              <span className="text-sm text-charcoal truncate">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {results.users && results.users.length > 0 && (
                        <div className="py-2 border-t border-border">
                          <div className="px-3 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
                            Users
                          </div>
                          {results.users.slice(0, 3).map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleResultClick(`/profile/${user.id}`)}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors w-full text-left"
                            >
                              <UserAvatar user={user} size="sm" className="w-10 h-10" />
                              <div className="min-w-0">
                                <p className="text-sm text-charcoal truncate">{user.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {results.ingredients && results.ingredients.length > 0 && (
                        <div className="py-2 border-t border-border">
                          <div className="px-3 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
                            Ingredients
                          </div>
                          {results.ingredients.slice(0, 3).map(ing => (
                            <button
                              key={ing.id}
                              onClick={() => handleResultClick(`/ingredients/${ing.id}`)}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-cream transition-colors w-full text-left"
                            >
                              <div className="w-10 h-10 rounded-full bg-green-100 flex-shrink-0 flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-charcoal truncate">{ing.name}</p>
                                <p className="text-xs text-warm-gray">{ing.recipe_count} recipes</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Search All & Create Recipe */}
                  {query.length >= 2 && (
                    <div className="border-t border-border">
                      <button
                        onClick={handleSearchAll}
                        className="w-full flex items-center gap-2 px-3 py-3 hover:bg-cream transition-colors text-sm"
                      >
                        <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-charcoal">Search all for "{query}"</span>
                      </button>
                      <button
                        onClick={() => {
                          router.push(`/recipes/new?title=${encodeURIComponent(query.trim())}`);
                          handleClose();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-3 hover:bg-cream transition-colors text-sm border-t border-border"
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

          {/* Notification Bell */}
          <NotificationBell />
        </div>
      </div>
    </nav>
  );
}
