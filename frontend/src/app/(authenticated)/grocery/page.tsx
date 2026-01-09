'use client';

import { useState } from 'react';
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
    toggleItemStaple,
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
    userSearchQuery,
    setUserSearchQuery,
    userSearchResults,
    searchingUsers,
    sharingUser,
    handleShareWithUser,
    handleRemoveShare,
    acceptShare,
    declineShare,
    leaveSharedList,
  } = useGroceryList();

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

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

        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden fixed bottom-20 left-4 z-30 p-3 bg-gold text-white rounded-full shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)} />
            <div className="absolute left-0 top-0 h-full">
              <GroceryListSidebar
                myLists={myLists}
                sharedWithMe={sharedWithMe}
                selectedListId={selectedListId}
                onSelectList={(id) => {
                  setSelectedListId(id);
                  setIsSidebarOpen(false);
                }}
                onCreateList={createList}
                onRenameList={renameList}
                onDeleteList={deleteList}
                onAcceptShare={acceptShare}
                onDeclineShare={declineShare}
                onLeaveSharedList={leaveSharedList}
                loading={loadingLists}
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-8 py-8">
          <GroceryListView
            groceryList={groceryList}
            loading={loading}
            error={error}
            selectedListId={selectedListId}
            toggleItemChecked={toggleItemChecked}
            toggleItemStaple={toggleItemStaple}
            addItem={addItem}
            deleteItem={deleteItem}
            clearCheckedItems={clearCheckedItems}
            clearAllItems={clearAllItems}
            isGenerating={isGenerating}
            generateFromMealPlan={generateFromMealPlan}
            isGenerateModalOpen={isGenerateModalOpen}
            setIsGenerateModalOpen={setIsGenerateModalOpen}
            shares={shares}
            userSearchQuery={userSearchQuery}
            setUserSearchQuery={setUserSearchQuery}
            userSearchResults={userSearchResults}
            searchingUsers={searchingUsers}
            sharingUser={sharingUser}
            handleShareWithUser={handleShareWithUser}
            handleRemoveShare={handleRemoveShare}
          />
        </main>
      </div>
    </div>
  );
}
