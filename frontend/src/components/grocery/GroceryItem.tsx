'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { GroceryListItem } from '@/types';

const CATEGORY_OPTIONS = [
  { value: 'produce', label: 'Produce' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'meat', label: 'Meat & Seafood' },
  { value: 'deli', label: 'Deli' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'grains', label: 'Grains & Pasta' },
  { value: 'canned', label: 'Canned Goods' },
  { value: 'oils', label: 'Oils & Vinegars' },
  { value: 'spices', label: 'Spices & Seasonings' },
  { value: 'condiments', label: 'Condiments' },
  { value: 'baking', label: 'Baking' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'nuts', label: 'Nuts & Seeds' },
  { value: 'international', label: 'International' },
  { value: 'health', label: 'Health Foods' },
  { value: 'staples', label: 'Check Pantry' },
  { value: 'other', label: 'Other' },
];

interface GroceryItemProps {
  item: GroceryListItem;
  onToggleChecked: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onChangeCategory?: (itemId: string, category: string) => Promise<void>;
}

export function GroceryItem({ item, onToggleChecked, onDelete, onChangeCategory }: GroceryItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const hasRecipes = item.source_recipes && item.source_recipes.length > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCategoryChange = async (newCategory: string) => {
    if (!onChangeCategory || newCategory === item.category) {
      setIsEditingCategory(false);
      return;
    }

    setIsSavingCategory(true);
    try {
      await onChangeCategory(item.id, newCategory);
      setIsEditingCategory(false);
    } catch (err) {
      console.error('Failed to change category:', err);
    } finally {
      setIsSavingCategory(false);
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
          {/* Category edit button */}
          {onChangeCategory && (
            <button
              onClick={() => setIsEditingCategory(true)}
              className="p-1.5 sm:p-1 text-warm-gray/50 hover:text-gold transition-colors"
              title="Change category"
            >
              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </button>
          )}
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

      {/* Category editing dropdown */}
      {isEditingCategory && (
        <div className="px-2 pb-2 pl-9">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={item.category || 'other'}
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={isSavingCategory}
              className="px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold disabled:opacity-50"
              autoFocus
            >
              {CATEGORY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsEditingCategory(false)}
              disabled={isSavingCategory}
              className="text-xs text-warm-gray hover:text-charcoal"
            >
              Cancel
            </button>
            {isSavingCategory && (
              <span className="text-xs text-warm-gray">Saving...</span>
            )}
          </div>
        </div>
      )}

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
