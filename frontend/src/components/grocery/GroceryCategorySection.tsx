'use client';

import { useState } from 'react';
import type { GroceryListItem } from '@/types';
import { GroceryItem } from './GroceryItem';
import { CATEGORY_LABELS } from '@/hooks/useGroceryList';

interface GroceryCategorySectionProps {
  category: string;
  items: GroceryListItem[];
  defaultCollapsed?: boolean;
  onToggleItemChecked: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}

export function GroceryCategorySection({
  category,
  items,
  defaultCollapsed = false,
  onToggleItemChecked,
  onDeleteItem,
}: GroceryCategorySectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const checkedCount = items.filter(i => i.is_checked).length;
  const totalCount = items.length;
  const label = CATEGORY_LABELS[category] || category;

  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      {/* Category header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between py-1.5 px-2 bg-cream/50 rounded hover:bg-cream transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-warm-gray transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-charcoal">{label}</span>
        </div>
        <span className="text-xs text-warm-gray">
          {checkedCount}/{totalCount}
        </span>
      </button>

      {/* Items list */}
      {!isCollapsed && (
        <div className="mt-0.5">
          {items.map(item => (
            <GroceryItem
              key={item.id}
              item={item}
              onToggleChecked={onToggleItemChecked}
              onDelete={onDeleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
