'use client';

import { useState } from 'react';
import { getErrorMessage, groceryListApi } from '@/lib/api';
import { Modal } from '@/components/ui';

interface AddToGroceryListModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  recipeYield?: number;
  onSuccess?: (listName: string, servings: number) => void;
}

export function AddToGroceryListModal({
  isOpen,
  onClose,
  recipeId,
  recipeTitle,
  recipeYield,
  onSuccess,
}: AddToGroceryListModalProps) {
  const initialServings = Math.min(100, Math.max(1, Math.round(recipeYield || 2)));
  const [servings, setServings] = useState(initialServings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateServings = (value: number) => {
    if (Number.isFinite(value)) {
      setServings(Math.min(100, Math.max(1, Math.round(value))));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const lists = await groceryListApi.list();
      const list = lists[0] || await groceryListApi.create();
      await groceryListApi.addRecipe(list.id, recipeId, servings);
      onSuccess?.(list.name, servings);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to add recipe to grocery list'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" position="bottom-sheet" ariaLabel="Add to Grocery List">
      <div className="bg-white rounded-t-xl md:rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-charcoal">Add to Grocery List</h2>
            <p className="text-sm text-warm-gray truncate">{recipeTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-warm-gray hover:text-charcoal transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-[calc(1.25rem+var(--safe-area-bottom))] space-y-5">
          <div>
            <label htmlFor="grocery-servings" className="block text-sm font-medium text-charcoal mb-2">
              How many servings?
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => updateServings(servings - 1)}
                disabled={servings <= 1}
                className="w-11 h-11 rounded-full border border-border text-xl text-charcoal hover:border-gold disabled:opacity-40 transition-colors"
                aria-label="Decrease servings"
              >
                -
              </button>
              <input
                id="grocery-servings"
                type="number"
                min="1"
                max="100"
                step="1"
                inputMode="numeric"
                value={servings}
                onChange={(event) => updateServings(Number(event.target.value))}
                className="w-20 h-12 rounded-lg border border-border bg-cream text-center text-xl font-medium text-charcoal focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none"
              />
              <button
                type="button"
                onClick={() => updateServings(servings + 1)}
                disabled={servings >= 100}
                className="w-11 h-11 rounded-full border border-border text-xl text-charcoal hover:border-gold disabled:opacity-40 transition-colors"
                aria-label="Increase servings"
              >
                +
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-warm-gray">
              Ingredient quantities will be scaled for {servings} serving{servings === 1 ? '' : 's'}.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-warm-gray hover:text-charcoal transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gold hover:bg-gold-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add to Grocery List'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
