'use client';

import Link from 'next/link';
import type { RecipeSummary } from '@/types';

interface RecipeCardProps {
  recipe: RecipeSummary;
  showAuthor?: boolean;
}

export function RecipeCard({ recipe, showAuthor = false }: RecipeCardProps) {
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  const difficultyColor = {
    easy: 'text-green-400',
    medium: 'text-yellow-400',
    hard: 'text-red-400',
  };

  return (
    <Link href={`/recipes/${recipe.id}`}>
      <div className="card hover:border-primary/50 transition-all cursor-pointer group">
        {/* Cover Image */}
        <div className="aspect-video bg-dark-hover rounded-lg mb-4 overflow-hidden">
          {recipe.cover_image_url ? (
            <img
              src={recipe.cover_image_url}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              🍽️
            </div>
          )}
        </div>

        {/* Content */}
        <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {recipe.title}
        </h3>

        {recipe.description && (
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">
            {recipe.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <span>⏱️</span>
              <span>{totalTime} min</span>
            </span>
          )}

          {recipe.difficulty && (
            <span className={`capitalize ${difficultyColor[recipe.difficulty]}`}>
              {recipe.difficulty}
            </span>
          )}

          <span className="flex items-center gap-1">
            <span>🍽️</span>
            <span>{recipe.yield_quantity} {recipe.yield_unit}</span>
          </span>
        </div>

        {/* Author */}
        {showAuthor && recipe.author && (
          <div className="mt-3 pt-3 border-t border-dark-hover flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-dark-hover flex items-center justify-center overflow-hidden flex-shrink-0">
              {recipe.author.profile_image_url ? (
                <img
                  src={recipe.author.profile_image_url}
                  alt={recipe.author.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs">{recipe.author.name.charAt(0)}</span>
              )}
            </div>
            <span className="text-sm text-gray-400 truncate">{recipe.author.name}</span>
          </div>
        )}

        {/* Privacy indicator */}
        {!showAuthor && recipe.privacy_level === 'public' && (
          <div className="mt-3 pt-3 border-t border-dark-hover">
            <span className="text-xs text-gray-500">
              🌐 Public
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default RecipeCard;
