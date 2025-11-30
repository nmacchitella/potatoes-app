'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { socialApi, recipeApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import RecipeCard from '@/components/recipes/RecipeCard';
import type { RecipeSummary } from '@/types';

type FeedTab = 'following' | 'discover';

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<FeedTab>('following');
  const [followingRecipes, setFollowingRecipes] = useState<RecipeSummary[]>([]);
  const [discoverRecipes, setDiscoverRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const loadRecipes = async () => {
      setLoading(true);
      try {
        if (activeTab === 'following') {
          const response = await socialApi.getFeed(1, 12);
          setFollowingRecipes(response.items);
          setHasMore(response.page < response.total_pages);
        } else {
          const response = await recipeApi.getPublicFeed(1, 12);
          setDiscoverRecipes(response.items);
          setHasMore(response.page < response.total_pages);
        }
        setPage(1);
      } catch (err) {
        console.error('Failed to load feed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRecipes();
  }, [activeTab]);

  const loadMore = async () => {
    const nextPage = page + 1;
    try {
      if (activeTab === 'following') {
        const response = await socialApi.getFeed(nextPage, 12);
        setFollowingRecipes([...followingRecipes, ...response.items]);
        setHasMore(response.page < response.total_pages);
      } else {
        const response = await recipeApi.getPublicFeed(nextPage, 12);
        setDiscoverRecipes([...discoverRecipes, ...response.items]);
        setHasMore(response.page < response.total_pages);
      }
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  };

  const recipes = activeTab === 'following' ? followingRecipes : discoverRecipes;

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Feed</h1>
            <Link href="/users/search" className="btn-secondary">
              Find People
            </Link>
          </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-card rounded-lg p-1 mb-8 w-fit">
          <button
            onClick={() => setActiveTab('following')}
            className={`px-6 py-2 rounded-md transition-colors ${
              activeTab === 'following'
                ? 'bg-primary text-black font-medium'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Following
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`px-6 py-2 rounded-md transition-colors ${
              activeTab === 'discover'
                ? 'bg-primary text-black font-medium'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Discover
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-dark-hover rounded-lg mb-3" />
                <div className="h-5 bg-dark-hover rounded w-3/4 mb-2" />
                <div className="h-4 bg-dark-hover rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="card text-center py-16">
            {activeTab === 'following' ? (
              <>
                <svg
                  className="w-16 h-16 mx-auto text-gray-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-gray-400 mb-2">No recipes from people you follow yet</p>
                <p className="text-gray-500 text-sm mb-6">
                  Follow other cooks to see their recipes here
                </p>
                <Link href="/users/search" className="btn-primary">
                  Find People to Follow
                </Link>
              </>
            ) : (
              <>
                <svg
                  className="w-16 h-16 mx-auto text-gray-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-gray-400 mb-2">No public recipes found</p>
                <p className="text-gray-500 text-sm">
                  Be the first to share a recipe!
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} showAuthor />
              ))}
            </div>

            {hasMore && (
              <div className="text-center mt-8">
                <button onClick={loadMore} className="btn-secondary">
                  Load More
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
