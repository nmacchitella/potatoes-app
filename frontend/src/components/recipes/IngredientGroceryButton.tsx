'use client';

import { useState, useRef } from 'react';
import { groceryListApi, getErrorMessage } from '@/lib/api';
import { useClickOutside } from '@/hooks/useClickOutside';

interface IngredientGroceryButtonProps {
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
  /** Current display scale so the added quantity matches what's on screen. */
  scale?: number;
  onAdded?: (ingredientName: string) => void;
  onError?: (message: string) => void;
}

type Status = 'idle' | 'adding' | 'added';

/**
 * Small per-ingredient control that reveals a popover with the option to add
 * just that ingredient to the user's grocery list.
 */
export function IngredientGroceryButton({
  recipeId,
  ingredientId,
  ingredientName,
  scale = 1,
  onAdded,
  onError,
}: IngredientGroceryButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false), open);

  const handleAdd = async () => {
    if (status !== 'idle') return;
    setStatus('adding');
    try {
      const lists = await groceryListApi.list();
      const list = lists[0] || (await groceryListApi.create());
      await groceryListApi.addRecipeIngredient(list.id, recipeId, ingredientId, scale);
      setStatus('added');
      onAdded?.(ingredientName);
      setTimeout(() => {
        setOpen(false);
        setStatus('idle');
      }, 1000);
    } catch (err) {
      setStatus('idle');
      setOpen(false);
      onError?.(getErrorMessage(err, 'Failed to add ingredient'));
    }
  };

  return (
    <div ref={ref} className="absolute right-0 top-0 inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Add ${ingredientName} to grocery list`}
        title="Add to grocery list"
        className={`flex items-center justify-center w-5 h-5 rounded-full text-warm-gray/50 hover:text-gold hover:bg-gold/10 focus:text-gold focus:opacity-100 transition-colors ${
          open ? 'text-gold opacity-100' : 'opacity-60 group-hover:opacity-100'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-white border border-border rounded-lg shadow-lg p-1">
          <button
            type="button"
            onClick={handleAdd}
            disabled={status !== 'idle'}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-charcoal hover:bg-cream rounded transition-colors disabled:opacity-70"
          >
            {status === 'added' ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Added
              </>
            ) : status === 'adding' ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border border-gold border-t-transparent flex-shrink-0" />
                Adding…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Add to grocery list
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
