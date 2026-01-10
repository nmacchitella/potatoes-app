'use client';

import Link from 'next/link';
import { useGroceryList } from '@/hooks/useGroceryList';
import { GroceryListView, GroceryListSidebar } from '@/components/grocery';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';

export default function GroceryListPage() {
  const {
    // Lists management
    myLists,
    sharedWithMe,
    loadingLists,
    selectedListId,
    setSelectedListId,
    createList,
    renameList,
    deleteList,
    // Grocery list data
    groceryList,
    loading,
    error,
    // Item operations
    toggleItemChecked,
    addItem,
    deleteItem,
    changeItemCategory,
    clearCheckedItems,
    clearAllItems,
    // Generate
    isGenerating,
    generateFromMealPlan,
    isGenerateModalOpen,
    setIsGenerateModalOpen,
    // Sharing
    shares,
    handleRemoveShare,
    acceptShare,
    declineShare,
    leaveSharedList,
  } = useGroceryList();

  // Check if the selected list is owned by the current user
  const isOwner = selectedListId ? myLists.some(list => list.id === selectedListId) : false;

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper
        groceryLists={myLists}
        sharedGroceryLists={sharedWithMe}
        selectedListId={selectedListId}
        onSelectList={setSelectedListId}
        onCreateList={createList}
        onRenameList={renameList}
        onDeleteList={deleteList}
        onAcceptShare={acceptShare}
        onDeclineShare={declineShare}
        onLeaveSharedList={leaveSharedList}
        loadingLists={loadingLists}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              {/* Main Navigation */}
              <div className="space-y-1 mb-4 pb-4 border-b border-border">
                <Link
                  href="/"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors text-charcoal hover:bg-cream-dark"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>Recipes</span>
                </Link>
                <Link
                  href="/?view=calendar"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors text-charcoal hover:bg-cream-dark"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Meal Plan</span>
                </Link>
                <div
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left bg-gold/10 text-gold-dark font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Grocery List</span>
                </div>
                <Link
                  href="/ingredients"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors text-charcoal hover:bg-cream-dark"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>Ingredients</span>
                </Link>
              </div>

              {/* Grocery List Sidebar Content */}
              <GroceryListSidebar
                myLists={myLists}
                sharedWithMe={sharedWithMe}
                selectedListId={selectedListId}
                onSelectList={setSelectedListId}
                onCreateList={createList}
                onRenameList={renameList}
                onDeleteList={deleteList}
                onAcceptShare={acceptShare}
                onDeclineShare={declineShare}
                onLeaveSharedList={leaveSharedList}
                loading={loadingLists}
              />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 py-2">
          <GroceryListView
            groceryList={groceryList}
            loading={loading}
            error={error}
            selectedListId={selectedListId}
            isOwner={isOwner}
            toggleItemChecked={toggleItemChecked}
            addItem={addItem}
            deleteItem={deleteItem}
            changeItemCategory={changeItemCategory}
            clearCheckedItems={clearCheckedItems}
            clearAllItems={clearAllItems}
            isGenerating={isGenerating}
            generateFromMealPlan={generateFromMealPlan}
            isGenerateModalOpen={isGenerateModalOpen}
            setIsGenerateModalOpen={setIsGenerateModalOpen}
            shares={shares}
            handleRemoveShare={handleRemoveShare}
          />
          </main>
        </div>
      </div>
    </div>
  );
}
