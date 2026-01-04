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
  const [showActions, setShowActions] = useState(false);

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
      className={`group flex items-center gap-2 py-1.5 px-2 rounded transition-colors ${
        item.is_checked ? 'bg-warm-gray/10' : 'hover:bg-warm-gray/5'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleChecked(item.id)}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          item.is_checked
            ? 'bg-gold border-gold text-white'
            : 'border-warm-gray/50 hover:border-gold'
        }`}
      >
        {item.is_checked && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Item name and quantity inline */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
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
      </div>

      {/* Recipe sources - shown as small clickable tags */}
      {item.source_recipes && item.source_recipes.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          {item.source_recipes.slice(0, 2).map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="text-[10px] px-1.5 py-0.5 bg-gold/10 text-gold/80 rounded hover:bg-gold/20 transition-colors truncate max-w-[80px]"
              title={recipe.title}
            >
              {recipe.title}
            </Link>
          ))}
          {item.source_recipes.length > 2 && (
            <span className="text-[10px] text-warm-gray">
              +{item.source_recipes.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Actions - visible on hover */}
      <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        {/* Pantry toggle */}
        <button
          onClick={() => onToggleStaple(item.id, !item.is_staple)}
          className={`p-1 rounded transition-colors ${
            item.is_staple
              ? 'text-gold hover:text-gold/70'
              : 'text-warm-gray/50 hover:text-warm-gray'
          }`}
          title={item.is_staple ? 'Remove from pantry staples' : 'Mark as pantry staple'}
        >
          <svg className="w-3.5 h-3.5" fill={item.is_staple ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1 text-warm-gray/50 hover:text-red-500 transition-colors disabled:opacity-50"
          title="Remove item"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
