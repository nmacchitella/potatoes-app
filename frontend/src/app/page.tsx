'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { recipeApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import { Carousel } from '@/components/layout/Carousel';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import type { RecipeSummary } from '@/types';

export default function HomePage() {
  const { user, fetchUserProfile } = useStore();
  const [myRecipes, setMyRecipes] = useState<RecipeSummary[]>([]);
  const [trendingRecipes, setTrendingRecipes] = useState<RecipeSummary[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user's recipes
        setLoadingMy(true);
        const myRes = await recipeApi.list({ page_size: 10 });
        setMyRecipes(myRes.items);
      } catch (error) {
        console.error('Failed to fetch my recipes:', error);
      } finally {
        setLoadingMy(false);
      }

      try {
        // Fetch public/trending recipes
        setLoadingTrending(true);
        const trendingRes = await recipeApi.getPublicFeed(1, 10);
        setTrendingRecipes(trendingRes.items);
      } catch (error) {
        console.error('Failed to fetch trending recipes:', error);
      } finally {
        setLoadingTrending(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Welcome back, {user?.name || 'Chef'}!</h1>
            <p className="text-gray-400 text-sm">What would you like to cook today?</p>
          </div>

          {/* My Recipes Carousel */}
          <Carousel
            title="My Recipes"
            loading={loadingMy}
            emptyMessage="You haven't created any recipes yet. Start by adding your first recipe!"
            viewAllLink="/recipes"
          >
            {myRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} variant="compact" />
            ))}
          </Carousel>

          {/* Trending/Discover Carousel */}
          <Carousel
            title="Discover Recipes"
            loading={loadingTrending}
            emptyMessage="No public recipes to discover yet. Be the first to share!"
            viewAllLink="/feed"
          >
            {trendingRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} variant="compact" showAuthor />
            ))}
          </Carousel>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>Potatoes - Family Kitchen v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
