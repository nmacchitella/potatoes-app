'use client';

import { useState } from 'react';
import type { GroceryListItemCreateInput, Ingredient } from '@/types';
import { IngredientAutocomplete } from '@/components/recipes/IngredientAutocomplete';

interface AddItemFormProps {
  onAddItem: (data: GroceryListItemCreateInput) => Promise<void>;
}

export function AddItemForm({ onAddItem }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsAdding(true);
    try {
      await onAddItem({
        name: name.trim(),
        quantity: quantity ? parseFloat(quantity) : undefined,
        unit: unit.trim() || undefined,
        category: selectedCategory,
      });
      setName('');
      setQuantity('');
      setUnit('');
      setSelectedCategory(undefined);
      setShowExpanded(false);
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleIngredientSelect = async (ingredient: Ingredient) => {
    // Auto-add the ingredient immediately
    const category = ingredient.category ? ingredient.category.toLowerCase() : undefined;
    setIsAdding(true);
    try {
      await onAddItem({
        name: ingredient.name,
        category,
      });
      // Reset form
      setName('');
      setQuantity('');
      setUnit('');
      setSelectedCategory(undefined);
      setShowExpanded(false);
    } catch (err) {
      console.error('Failed to add item:', err);
      // On error, populate the form so user can try again
      setName(ingredient.name);
      if (category) {
        setSelectedCategory(category);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setName('');
      setShowExpanded(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <IngredientAutocomplete
            value={name}
            onChange={setName}
            onSelect={handleIngredientSelect}
            placeholder="Add item... (type to search ingredients)"
            className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          />
          {name && (
            <button
              type="button"
              onClick={() => setShowExpanded(!showExpanded)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-gray hover:text-charcoal z-10"
              title="Add quantity details"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showExpanded ? "M19 9l-7 7-7-7" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!name.trim() || isAdding}
          className="px-4 py-2.5 bg-gold text-white rounded-lg hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* Expanded form for quantity/unit */}
      {showExpanded && (
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Qty"
            step="0.25"
            min="0"
            className="w-20 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          />
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Unit (e.g., cups, lbs)"
            className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          />
          {selectedCategory && (
            <span className="flex items-center px-2 py-1 text-xs bg-warm-gray/10 text-warm-gray rounded">
              {selectedCategory}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
