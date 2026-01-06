'use client';

import { useState } from 'react';
import { useGroceryList, CATEGORY_ORDER } from '@/hooks/useGroceryList';
import { GroceryCategorySection } from './GroceryCategorySection';
import { AddItemForm } from './AddItemForm';
import { GenerateModal } from './GenerateModal';
import { groceryListApi } from '@/lib/api';

export function GroceryListView() {
  const {
    groceryList,
    loading,
    error,
    toggleItemChecked,
    toggleItemStaple,
    addItem,
    deleteItem,
    clearCheckedItems,
    clearAllItems,
    isGenerating,
    generateFromMealPlan,
    isGenerateModalOpen,
    setIsGenerateModalOpen,
  } = useGroceryList();

  // Share link state
  const [isSharePopupOpen, setIsSharePopupOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareClick = async () => {
    setIsSharePopupOpen(true);
    if (!shareLink) {
      setIsGeneratingLink(true);
      try {
        const { share_token } = await groceryListApi.getOrCreateShareLink();
        const link = `${window.location.origin}/grocery/share/${share_token}`;
        setShareLink(link);
      } catch (err) {
        console.error('Failed to generate share link:', err);
      } finally {
        setIsGeneratingLink(false);
      }
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          <h1 className="text-2xl font-semibold text-charcoal">Grocery List</h1>
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
          <div className="relative">
            <button
              onClick={handleShareClick}
              className="p-2 text-warm-gray hover:text-charcoal transition-colors"
              title="Share list"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>

            {/* Share popup */}
            {isSharePopupOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSharePopupOpen(false)}
                />
                {/* Popup */}
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-border z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-charcoal">Share grocery list</h3>
                    <button
                      onClick={() => setIsSharePopupOpen(false)}
                      className="text-warm-gray hover:text-charcoal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-warm-gray mb-3">
                    Anyone with this link can view your grocery list
                  </p>
                  {isGeneratingLink ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent" />
                    </div>
                  ) : shareLink ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm bg-cream border border-border rounded-lg text-charcoal truncate"
                      />
                      <button
                        onClick={handleCopyLink}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          copied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gold text-white hover:bg-gold/90'
                        }`}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-red-500">Failed to generate link</p>
                  )}
                </div>
              </>
            )}
          </div>
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
                onToggleItemStaple={toggleItemStaple}
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
                  onToggleItemStaple={toggleItemStaple}
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
    </div>
  );
}
