'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { MealPlan } from '@/types';

interface MealCardProps {
  meal: MealPlan;
  variant?: 'desktop' | 'mobile';
  isDragging?: boolean;
  isClipboard?: boolean;
  showActions?: boolean;
  onCopy?: (meal: MealPlan, e: React.MouseEvent) => void;
  onCut?: (meal: MealPlan, e: React.MouseEvent) => void;
  onRepeat?: (meal: MealPlan, e: React.MouseEvent) => void;
  onDelete?: (mealId: string, e: React.MouseEvent) => void;
  onDragStart?: (meal: MealPlan, e: React.DragEvent) => void;
  onDragEnd?: () => void;
  // Mobile-specific
  onToggleActions?: (mealId: string, e: React.MouseEvent) => void;
  isActionsOpen?: boolean;
  onMove?: (meal: MealPlan) => void;
  onEdit?: (meal: MealPlan, e: React.MouseEvent) => void;
}

// Custom item icon (takeout/external)
function CustomItemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
    </svg>
  );
}

export default function MealCard({
  meal,
  variant = 'desktop',
  isDragging = false,
  isClipboard = false,
  showActions = true,
  onCopy,
  onCut,
  onRepeat,
  onDelete,
  onDragStart,
  onDragEnd,
  onToggleActions,
  isActionsOpen = false,
  onMove,
  onEdit,
}: MealCardProps) {
  // Check if this is a custom item (no recipe)
  const isCustom = !meal.recipe;
  const title = isCustom ? meal.custom_title : meal.recipe?.title;

  if (variant === 'mobile') {
    return (
      <div className="relative">
        <div
          className={`rounded-lg p-2 ${isCustom ? 'bg-sage/10 border border-sage/20' : 'bg-cream'} ${isClipboard ? 'ring-2 ring-gold ring-offset-1' : ''}`}
          onClick={(e) => onToggleActions?.(meal.id, e)}
        >
          {/* Image or custom icon */}
          {isCustom ? (
            <div className="aspect-video rounded overflow-hidden mb-1 bg-sage/20 flex items-center justify-center">
              <CustomItemIcon className="w-8 h-8 text-sage" />
            </div>
          ) : meal.recipe?.cover_image_url ? (
            <div className="relative aspect-video rounded overflow-hidden mb-1">
              <Image src={meal.recipe.cover_image_url} alt="" fill sizes="200px" className="object-cover" />
            </div>
          ) : null}

          {/* Title */}
          {isCustom ? (
            <div className="font-medium text-charcoal text-[11px] line-clamp-2">
              {title}
            </div>
          ) : (
            <Link
              href={`/recipes/${meal.recipe?.id}`}
              className="font-medium text-charcoal hover:text-gold block text-[11px] line-clamp-2"
              onClick={(e) => e.stopPropagation()}
            >
              {title}
            </Link>
          )}

          {/* Custom badge */}
          {isCustom && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sage/20 text-sage font-medium">
                Custom
              </span>
            </div>
          )}
        </div>

        {/* Mobile Action Menu */}
        {isActionsOpen && showActions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-border z-10 py-1">
            {!isCustom && meal.recipe && (
              <Link
                href={`/recipes/${meal.recipe.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-charcoal hover:bg-cream"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Recipe
              </Link>
            )}
            {onEdit && (
              <button
                onClick={(e) => onEdit(meal, e)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-charcoal hover:bg-cream w-full text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20H5a2 2 0 01-2-2v-1a1 1 0 011-1h1V9a4 4 0 014-4h4a4 4 0 014 4v7h1a1 1 0 011 1v1a2 2 0 01-2 2zm-5-12a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                Edit Servings
              </button>
            )}
            {onMove && (
              <button
                onClick={() => onMove(meal)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-charcoal hover:bg-cream w-full text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Move
              </button>
            )}
            {onCopy && (
              <button
                onClick={(e) => onCopy(meal, e)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-charcoal hover:bg-cream w-full text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            )}
            {onRepeat && !isCustom && (
              <button
                onClick={(e) => onRepeat(meal, e)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-charcoal hover:bg-cream w-full text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Repeat Weekly
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => onDelete(meal.id, e)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop variant
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(meal, e)}
      onDragEnd={onDragEnd}
      className={`group relative rounded-lg p-2 transition-all ${
        isCustom ? 'bg-sage/10 border border-sage/20' : 'bg-cream hover:bg-cream-dark'
      } ${
        onDragStart ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-50 scale-95' : ''} ${isClipboard ? 'ring-2 ring-gold ring-offset-1' : ''}`}
    >
      {/* Image or custom icon */}
      {isCustom ? (
        <div className="aspect-video rounded overflow-hidden mb-1.5 bg-sage/20 flex items-center justify-center">
          <CustomItemIcon className="w-6 h-6 text-sage" />
        </div>
      ) : meal.recipe?.cover_image_url ? (
        <div className="relative aspect-video rounded overflow-hidden mb-1.5">
          <Image src={meal.recipe.cover_image_url} alt={title || ''} fill sizes="200px" className="object-cover" />
        </div>
      ) : null}

      {/* Title */}
      {isCustom ? (
        <div className="font-medium text-charcoal text-xs line-clamp-2">
          {title}
        </div>
      ) : (
        <Link
          href={`/recipes/${meal.recipe?.id}`}
          className="font-medium text-charcoal hover:text-gold block text-xs line-clamp-2"
          onClick={(e) => e.stopPropagation()}
        >
          {title}
        </Link>
      )}

      {/* Servings and custom badge */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-[10px] text-warm-gray">{meal.servings} servings</span>
        {isCustom && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-sage/20 text-sage font-medium">
            Custom
          </span>
        )}
      </div>

      {/* Description tooltip for custom items */}
      {isCustom && meal.custom_description && (
        <div className="text-[10px] text-warm-gray mt-1 line-clamp-1" title={meal.custom_description}>
          {meal.custom_description}
        </div>
      )}

      {/* Action buttons */}
      {showActions && (
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => onEdit(meal, e)}
              className="p-1 rounded bg-white/80 text-warm-gray hover:text-charcoal"
              title="Edit servings"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {onCopy && (
            <button
              onClick={(e) => onCopy(meal, e)}
              className="p-1 rounded bg-white/80 text-warm-gray hover:text-gold"
              title="Copy"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          {onCut && (
            <button
              onClick={(e) => onCut(meal, e)}
              className="p-1 rounded bg-white/80 text-warm-gray hover:text-orange-500"
              title="Cut"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
              </svg>
            </button>
          )}
          {onRepeat && !isCustom && (
            <button
              onClick={(e) => onRepeat(meal, e)}
              className="p-1 rounded bg-white/80 text-warm-gray hover:text-blue-500"
              title="Repeat"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => onDelete(meal.id, e)}
              className="p-1 rounded bg-white/80 text-warm-gray hover:text-red-500"
              title="Delete"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
