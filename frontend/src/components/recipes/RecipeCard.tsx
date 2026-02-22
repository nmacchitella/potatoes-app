'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { RecipeSummary } from '@/types';

type RecipeCardVariant = 'default' | 'compact';

interface RecipeCardProps {
  recipe: RecipeSummary;
  showAuthor?: boolean;
  variant?: RecipeCardVariant;
}

const difficultyColor = {
  easy: 'text-green-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
} as const;

/**
 * RecipeCard - Displays a recipe preview
 *
 * Variants:
 * - default: Full card with description, used in grids
 * - compact: Smaller card for carousels, shows tags instead of description
 */
export function RecipeCard({ recipe, showAuthor = false, variant = 'default' }: RecipeCardProps) {
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  if (variant === 'compact') {
    return (
      <Link
        href={`/recipes/${recipe.id}`}
        className="flex-shrink-0 w-64 bg-white rounded-lg border border-border hover:border-gold/50 transition-colors overflow-hidden group"
      >
        {/* Cover Image */}
        <div className="relative h-36 bg-cream-dark overflow-hidden">
          {recipe.cover_image_url ? (
            <Image
              src={recipe.cover_image_url}
              alt={recipe.title}
              fill
              sizes="256px"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-1 group-hover:text-gold transition-colors">
            {recipe.title}
          </h3>

          {showAuthor && recipe.author && (
            <p className="text-xs text-warm-gray mt-1">
              by {recipe.author.name}
            </p>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-2 text-xs text-warm-gray">
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {totalTime} min
              </span>
            )}
            {recipe.difficulty && (
              <span className={`capitalize ${difficultyColor[recipe.difficulty]}`}>
                {recipe.difficulty}
              </span>
            )}
          </div>

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipe.tags.slice(0, 2).map(tag => (
                <span
                  key={tag.id}
                  className="px-1.5 py-0.5 bg-cream-dark rounded text-xs text-warm-gray"
                >
                  {tag.name}
                </span>
              ))}
              {recipe.tags.length > 2 && (
                <span className="text-xs text-warm-gray">+{recipe.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  }

  // Default variant - full card
  return (
    <Link href={`/recipes/${recipe.id}`}>
      <div className="card hover:border-gold/50 transition-all cursor-pointer group">
        {/* Cover Image */}
        <div className="relative aspect-video bg-cream-dark rounded-lg mb-4 overflow-hidden">
          {recipe.cover_image_url ? (
            <Image
              src={recipe.cover_image_url}
              alt={recipe.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              🍽️
            </div>
          )}
          {recipe.status === 'draft' && (
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-500 text-white text-xs font-medium rounded">
              Draft
            </span>
          )}
        </div>

        {/* Content */}
        <h3 className="font-semibold text-lg mb-2 group-hover:text-gold transition-colors line-clamp-1">
          {recipe.title}
        </h3>

        {recipe.description && (
          <p className="text-warm-gray text-sm mb-3 line-clamp-2">
            {recipe.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-warm-gray">
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
          <div className="mt-3 pt-3 border-t border-cream-dark flex items-center gap-2">
            <div className="relative w-6 h-6 rounded-full bg-cream-dark flex items-center justify-center overflow-hidden flex-shrink-0">
              {recipe.author.profile_image_url ? (
                <Image
                  src={recipe.author.profile_image_url}
                  alt={recipe.author.name}
                  fill
                  sizes="24px"
                  className="object-cover"
                />
              ) : (
                <span className="text-xs">{recipe.author.name.charAt(0)}</span>
              )}
            </div>
            <span className="text-sm text-warm-gray truncate">{recipe.author.name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default RecipeCard;
