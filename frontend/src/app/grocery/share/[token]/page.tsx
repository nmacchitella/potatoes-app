'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { groceryListApi } from '@/lib/api';
import type { GroceryList } from '@/types';

const CATEGORY_ORDER = [
  'produce',
  'dairy',
  'meat',
  'bakery',
  'frozen',
  'pantry',
  'beverages',
  'staples',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat & Seafood',
  bakery: 'Bakery',
  frozen: 'Frozen',
  pantry: 'Pantry',
  beverages: 'Beverages',
  staples: 'Check Pantry',
  spices: 'Spices & Seasonings',
  condiments: 'Condiments',
  grains: 'Grains & Pasta',
  canned: 'Canned Goods',
  snacks: 'Snacks',
  other: 'Other',
};

export default function PublicGroceryListPage() {
  const params = useParams();
  const token = params.token as string;

  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroceryList = async () => {
      try {
        const list = await groceryListApi.getPublicGroceryList(token);
        setGroceryList(list);
      } catch (err) {
        setError('Grocery list not found or link has expired');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchGroceryList();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (error || !groceryList) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-warm-gray mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h1 className="text-xl font-semibold text-charcoal mb-2">List not found</h1>
          <p className="text-warm-gray">{error || 'This grocery list does not exist or the link has expired.'}</p>
        </div>
      </div>
    );
  }

  const hasItems = groceryList.items.length > 0;
  const checkedCount = groceryList.items.filter(i => i.is_checked).length;
  const totalCount = groceryList.items.length;

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-warm-gray text-sm mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>Shared grocery list</span>
          </div>
          <h1 className="text-2xl font-semibold text-charcoal">Grocery List</h1>
          {hasItems && (
            <p className="text-sm text-warm-gray mt-1">
              {checkedCount} of {totalCount} items checked
            </p>
          )}
        </div>

        {/* Empty state */}
        {!hasItems && (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <svg className="w-12 h-12 text-warm-gray mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-charcoal mb-2">This grocery list is empty</h3>
            <p className="text-warm-gray">No items have been added yet.</p>
          </div>
        )}

        {/* Items by category */}
        {hasItems && (
          <div className="space-y-4">
            {CATEGORY_ORDER.map(category => {
              const items = groceryList.items_by_category[category] || [];
              if (items.length === 0) return null;

              const uncheckedCount = items.filter(i => !i.is_checked).length;

              return (
                <div key={category} className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 bg-cream-dark border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-charcoal">
                        {CATEGORY_LABELS[category] || category}
                      </h3>
                      <span className="text-sm text-warm-gray">
                        {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className={`px-4 py-3 flex items-center gap-3 ${item.is_checked ? 'bg-cream/50' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          item.is_checked
                            ? 'bg-gold border-gold'
                            : 'border-border'
                        }`}>
                          {item.is_checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`${item.is_checked ? 'line-through text-warm-gray' : 'text-charcoal'}`}>
                            {item.quantity && item.quantity > 0 && (
                              <span className="text-warm-gray mr-1">
                                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                              </span>
                            )}
                            {item.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Render any additional categories not in CATEGORY_ORDER */}
            {Object.keys(groceryList.items_by_category)
              .filter(cat => !CATEGORY_ORDER.includes(cat as typeof CATEGORY_ORDER[number]))
              .map(category => {
                const items = groceryList.items_by_category[category] || [];
                if (items.length === 0) return null;

                const uncheckedCount = items.filter(i => !i.is_checked).length;

                return (
                  <div key={category} className="bg-white rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-3 bg-cream-dark border-b border-border">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-charcoal">
                          {CATEGORY_LABELS[category] || category}
                        </h3>
                        <span className="text-sm text-warm-gray">
                          {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`px-4 py-3 flex items-center gap-3 ${item.is_checked ? 'bg-cream/50' : ''}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            item.is_checked
                              ? 'bg-gold border-gold'
                              : 'border-border'
                          }`}>
                            {item.is_checked && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`${item.is_checked ? 'line-through text-warm-gray' : 'text-charcoal'}`}>
                              {item.quantity && item.quantity > 0 && (
                                <span className="text-warm-gray mr-1">
                                  {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                                </span>
                              )}
                              {item.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-warm-gray">
          <p>Shared via Potatoes</p>
        </div>
      </div>
    </div>
  );
}
