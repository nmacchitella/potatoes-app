'use client';

import { useGroceryList } from '@/hooks/useGroceryList';
import { GroceryListView, GroceryListSidebar } from '@/components/grocery';
import Navbar from '@/components/layout/Navbar';
import MainNavigation from '@/components/layout/MainNavigation';
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
              <MainNavigation currentPage="grocery" />

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
