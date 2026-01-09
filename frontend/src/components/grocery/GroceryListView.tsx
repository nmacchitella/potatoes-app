'use client';

import { useState } from 'react';
import { CATEGORY_ORDER } from '@/hooks/useGroceryList';
import { GroceryCategorySection } from './GroceryCategorySection';
import { AddItemForm } from './AddItemForm';
import { GenerateModal } from './GenerateModal';
import { groceryListApi } from '@/lib/api';
import type {
  GroceryList,
  GroceryListItemCreateInput,
  GroceryListShare,
  UserSearchResult,
} from '@/types';

interface GroceryListViewProps {
  groceryList: GroceryList | null;
  loading: boolean;
  error: string | null;
  selectedListId: string | null;
  // Item operations
  toggleItemChecked: (itemId: string) => Promise<void>;
  toggleItemStaple: (itemId: string, isStaple: boolean) => Promise<void>;
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
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  userSearchResults: UserSearchResult[];
  searchingUsers: boolean;
  sharingUser: string | null;
  handleShareWithUser: (userId: string) => Promise<void>;
  handleRemoveShare: (userId: string) => Promise<void>;
}

export function GroceryListView({
  groceryList,
  loading,
  error,
  selectedListId,
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
  shares,
  userSearchQuery,
  setUserSearchQuery,
  userSearchResults,
  searchingUsers,
  sharingUser,
  handleShareWithUser,
  handleRemoveShare,
}: GroceryListViewProps) {
  // Share link state
  const [isSharePopupOpen, setIsSharePopupOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // User share modal state
  const [isUserShareOpen, setIsUserShareOpen] = useState(false);

  const handleShareClick = async () => {
    if (!selectedListId) return;
    setIsSharePopupOpen(true);
    if (!shareLink) {
      setIsGeneratingLink(true);
      try {
        const { share_token } = await groceryListApi.getOrCreateShareLink(selectedListId);
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

  // Reset share link when list changes
  if (groceryList && shareLink && !shareLink.includes(groceryList.id)) {
    setShareLink(null);
  }

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

          {/* Share with user button */}
          <button
            onClick={() => setIsUserShareOpen(true)}
            className="p-2 text-warm-gray hover:text-charcoal transition-colors"
            title="Share with user"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>

          {/* Public share link */}
          <div className="relative">
            <button
              onClick={handleShareClick}
              className="p-2 text-warm-gray hover:text-charcoal transition-colors"
              title="Share link"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>

            {/* Share popup */}
            {isSharePopupOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSharePopupOpen(false)}
                />
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
                    Anyone with this link can view your grocery list (read-only)
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

      {/* User share modal */}
      {isUserShareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsUserShareOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-charcoal">Share with Users</h3>
              <button onClick={() => setIsUserShareOpen(false)} className="text-warm-gray hover:text-charcoal">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search users */}
            <div className="mb-4">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search users by name..."
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
              {searchingUsers && (
                <div className="mt-2 text-sm text-warm-gray">Searching...</div>
              )}
              {userSearchResults.length > 0 && (
                <ul className="mt-2 border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                  {userSearchResults.map((user) => (
                    <li key={user.id} className="flex items-center justify-between p-3 hover:bg-cream">
                      <div className="flex items-center gap-3">
                        {user.profile_image_url ? (
                          <img src={user.profile_image_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium text-charcoal">{user.name}</span>
                      </div>
                      <button
                        onClick={() => handleShareWithUser(user.id)}
                        disabled={sharingUser === user.id}
                        className="px-3 py-1 text-sm bg-gold text-white rounded-lg hover:bg-gold/90 disabled:opacity-50"
                      >
                        {sharingUser === user.id ? 'Sharing...' : 'Share'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Current shares */}
            {shares.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-warm-gray mb-2">Shared with</h4>
                <ul className="space-y-2">
                  {shares.map((share) => (
                    <li key={share.id} className="flex items-center justify-between p-2 bg-cream rounded-lg">
                      <div className="flex items-center gap-3">
                        {share.user.profile_image_url ? (
                          <img src={share.user.profile_image_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-medium">
                            {share.user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="text-sm font-medium text-charcoal">{share.user.name}</span>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                            share.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            share.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {share.status}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveShare(share.user_id)}
                        className="p-1 text-warm-gray hover:text-red-500"
                        title="Remove access"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

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
