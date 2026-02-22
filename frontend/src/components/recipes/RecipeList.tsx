'use client';

import { RecipeCard } from './RecipeCard';
import type { RecipeSummary } from '@/types';

interface RecipeListProps {
  recipes: RecipeSummary[];
  loading?: boolean;
  emptyMessage?: string;
}

export function RecipeList({ recipes, loading, emptyMessage = "No recipes found" }: RecipeListProps) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="aspect-video bg-cream-dark rounded-lg mb-4" />
            <div className="h-6 bg-cream-dark rounded mb-2 w-3/4" />
            <div className="h-4 bg-cream-dark rounded w-full mb-2" />
            <div className="h-4 bg-cream-dark rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-5xl mb-4">📖</div>
        <h3 className="text-xl font-semibold mb-2">{emptyMessage}</h3>
        <p className="text-warm-gray">
          Get started by creating your first recipe!
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}

export default RecipeList;
