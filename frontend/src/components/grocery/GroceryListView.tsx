'use client';

import { useState } from 'react';
import { CATEGORY_ORDER } from '@/hooks/useGroceryList';
import { GroceryCategorySection } from './GroceryCategorySection';
import { AddItemForm } from './AddItemForm';
import { GenerateModal } from './GenerateModal';
import { ShareModal } from './ShareModal';
import type {
  GroceryList,
  GroceryListItemCreateInput,
  GroceryListShare,
} from '@/types';

interface GroceryListViewProps {
  groceryList: GroceryList | null;
  loading: boolean;
  error: string | null;
  selectedListId: string | null;
  isOwner: boolean;
  // Item operations
  toggleItemChecked: (itemId: string) => Promise<void>;
  addItem: (data: GroceryListItemCreateInput) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  clearCheckedItems: () => Promise<void>;
  clearAllItems: () => Promise<void>;
  // Generate
  isGenerating: boolean;
  generateFromMealPlan: (startDate: string, endDate: string, merge: boolean) => Promise<void>;
  isGenerateModalOpen: boolean;
  setIsGenerateModalOpen: (open: boolean) => void;
  // Sharing
  shares: GroceryListShare[];
  handleRemoveShare: (userId: string) => Promise<void>;
}

export function GroceryListView({
  groceryList,
  loading,
  error,
  selectedListId,
  isOwner,
  toggleItemChecked,
  addItem,
  deleteItem,
  clearCheckedItems,
  clearAllItems,
  isGenerating,
  generateFromMealPlan,
  isGenerateModalOpen,
  setIsGenerateModalOpen,
  shares,
  handleRemoveShare,
}: GroceryListViewProps) {
  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  if (!selectedListId) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl">
        <svg className="w-12 h-12 text-warm-gray mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-lg font-medium text-charcoal mb-2">No list selected</h3>
        <p className="text-warm-gray">
          Select a grocery list from the sidebar or create a new one
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const hasItems = !!(groceryList && groceryList.items.length > 0);
  const hasCheckedItems = groceryList?.items.some(i => i.is_checked) || false;
  const checkedCount = groceryList?.items.filter(i => i.is_checked).length || 0;
  const totalCount = groceryList?.items.length || 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal">{groceryList?.name || 'Grocery List'}</h1>
          {hasItems && (
            <p className="text-sm text-warm-gray mt-1">
              {checkedCount} of {totalCount} items checked
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Generate
          </button>

          {/* Share button - only show for owners */}
          {isOwner && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-cream transition-colors text-charcoal"
              title="Share grocery list"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          )}
        </div>
      </div>

      {/* Add item form */}
      <AddItemForm onAddItem={addItem} />

      {/* Empty state */}
      {!hasItems && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <svg className="w-12 h-12 text-warm-gray mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-lg font-medium text-charcoal mb-2">Your grocery list is empty</h3>
          <p className="text-warm-gray mb-4">
            Add items manually or generate from your meal plan
          </p>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Generate from Meal Plan
          </button>
        </div>
      )}

      {/* Items by category */}
      {hasItems && groceryList && (
        <>
          {/* Render categories in order */}
          {CATEGORY_ORDER.map(category => {
            const items = groceryList.items_by_category[category] || [];
            return (
              <GroceryCategorySection
                key={category}
                category={category}
                items={items}
                defaultCollapsed={category === 'staples'}
                onToggleItemChecked={toggleItemChecked}
                onDeleteItem={deleteItem}
              />
            );
          })}
          {/* Render any additional categories not in CATEGORY_ORDER */}
          {Object.keys(groceryList.items_by_category)
            .filter(cat => !CATEGORY_ORDER.includes(cat as typeof CATEGORY_ORDER[number]))
            .map(category => {
              const items = groceryList.items_by_category[category] || [];
              return (
                <GroceryCategorySection
                  key={category}
                  category={category}
                  items={items}
                  defaultCollapsed={false}
                  onToggleItemChecked={toggleItemChecked}
                  onDeleteItem={deleteItem}
                />
              );
            })}

          {/* Clear buttons */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
            {hasCheckedItems && (
              <button
                onClick={clearCheckedItems}
                className="text-sm text-warm-gray hover:text-charcoal transition-colors"
              >
                Clear checked items
              </button>
            )}
            <button
              onClick={clearAllItems}
              className="text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              Clear all
            </button>
          </div>
        </>
      )}

      {/* Generate modal */}
      <GenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={generateFromMealPlan}
        isGenerating={isGenerating}
        hasExistingItems={hasItems}
      />

      {/* Share modal */}
      {selectedListId && groceryList && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          listId={selectedListId}
          listName={groceryList.name}
          shares={shares}
          onRemoveShare={handleRemoveShare}
        />
      )}
    </div>
  );
}
