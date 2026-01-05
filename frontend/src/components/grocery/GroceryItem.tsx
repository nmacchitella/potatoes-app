'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { GroceryListItem } from '@/types';

interface GroceryItemProps {
  item: GroceryListItem;
  onToggleChecked: (itemId: string) => void;
  onToggleStaple: (itemId: string, isStaple: boolean) => void;
  onDelete: (itemId: string) => void;
}

export function GroceryItem({ item, onToggleChecked, onToggleStaple, onDelete }: GroceryItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const hasRecipes = item.source_recipes && item.source_recipes.length > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatQuantity = () => {
    if (!item.quantity) return null;
    const qty = item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1);
    return item.unit ? `${qty} ${item.unit}` : String(qty);
  };

  const quantity = formatQuantity();

  return (
    <div
      className={`group rounded transition-colors ${
        item.is_checked ? 'bg-warm-gray/10' : 'hover:bg-warm-gray/5'
      }`}
    >
      <div className="flex items-center gap-2 py-2 px-2">
        {/* Checkbox - larger touch target on mobile */}
        <button
          onClick={() => onToggleChecked(item.id)}
          className={`w-5 h-5 sm:w-4 sm:h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            item.is_checked
              ? 'bg-gold border-gold text-white'
              : 'border-warm-gray/50 hover:border-gold'
          }`}
        >
          {item.is_checked && (
            <svg className="w-3 h-3 sm:w-2.5 sm:h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Item name and quantity inline */}
        <button
          onClick={() => hasRecipes && setIsExpanded(!isExpanded)}
          className={`flex-1 min-w-0 flex items-center gap-2 text-left ${hasRecipes ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {hasRecipes && (
            <svg
              className={`w-3 h-3 text-warm-gray/50 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <span
            className={`text-sm truncate ${
              item.is_checked ? 'text-warm-gray line-through' : 'text-charcoal'
            }`}
          >
            {item.name}
          </span>
          {quantity && (
            <span className="text-xs text-warm-gray flex-shrink-0">
              {quantity}
            </span>
          )}
          {hasRecipes && !isExpanded && (
            <span className="text-[10px] text-warm-gray/60 flex-shrink-0">
              ({item.source_recipes.length})
            </span>
          )}
        </button>

        {/* Actions - always visible on mobile, hover on desktop */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {/* Pantry toggle */}
          <button
            onClick={() => onToggleStaple(item.id, !item.is_staple)}
            className={`p-1.5 sm:p-1 rounded transition-colors ${
              item.is_staple
                ? 'text-gold hover:text-gold/70'
                : 'text-warm-gray/50 hover:text-warm-gray'
            }`}
            title={item.is_staple ? 'Remove from pantry staples' : 'Mark as pantry staple'}
          >
            <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill={item.is_staple ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 sm:p-1 text-warm-gray/50 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Remove item"
          >
            <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded recipes list */}
      {isExpanded && hasRecipes && (
        <div className="pl-10 sm:pl-8 pr-2 pb-2 space-y-1">
          {item.source_recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="flex items-center gap-2 text-xs text-warm-gray hover:text-gold transition-colors py-1 sm:py-0.5"
            >
              <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="truncate">{recipe.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
