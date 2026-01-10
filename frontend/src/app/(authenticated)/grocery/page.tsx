'use client';

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

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block h-[calc(100vh-64px)] sticky top-16">
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

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-8 py-8">
          <GroceryListView
            groceryList={groceryList}
            loading={loading}
            error={error}
            selectedListId={selectedListId}
            isOwner={isOwner}
            toggleItemChecked={toggleItemChecked}
            addItem={addItem}
            deleteItem={deleteItem}
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
  );
}
