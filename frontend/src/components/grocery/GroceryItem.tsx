'use client';

import { useState } from 'react';
import type { GroceryListItem } from '@/types';

interface GroceryItemProps {
  item: GroceryListItem;
  onToggleChecked: (itemId: string) => void;
  onDelete: (itemId: string) => void;
}

export function GroceryItem({ item, onToggleChecked, onDelete }: GroceryItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatQuantity = () => {
    if (!item.quantity) return '';
    const qty = item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2);
    return item.unit ? `${qty} ${item.unit}` : qty;
  };

  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
        item.is_checked ? 'bg-warm-gray/10' : 'hover:bg-warm-gray/5'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleChecked(item.id)}
        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          item.is_checked
            ? 'bg-gold border-gold text-white'
            : 'border-warm-gray hover:border-gold'
        }`}
      >
        {item.is_checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Item details */}
      <div className="flex-1 min-w-0">
        <span
          className={`block truncate ${
            item.is_checked ? 'text-warm-gray line-through' : 'text-charcoal'
          }`}
        >
          {item.name}
        </span>
        {item.quantity && (
          <span className="text-sm text-warm-gray">
            {formatQuantity()}
          </span>
        )}
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.is_manual && (
          <span className="text-xs px-1.5 py-0.5 bg-warm-gray/10 text-warm-gray rounded">
            manual
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="p-1 text-warm-gray hover:text-red-500 transition-colors disabled:opacity-50"
        title="Remove item"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
