'use client';

import { useState, Suspense } from 'react';
import MobileNav from './MobileNav';
import MobileSidebar from './MobileSidebar';
import BottomNav from './BottomNav';
import type { GroceryListSummary, SharedGroceryListAccess } from '@/types';

interface MobileNavWrapperProps {
  groceryLists?: GroceryListSummary[];
  sharedGroceryLists?: SharedGroceryListAccess[];
  selectedListId?: string | null;
  onSelectList?: (id: string) => void;
  onCreateList?: (name?: string) => Promise<GroceryListSummary>;
  onRenameList?: (listId: string, name: string) => Promise<void>;
  onDeleteList?: (listId: string) => Promise<void>;
  onAcceptShare?: (shareId: string) => Promise<void>;
  onDeclineShare?: (shareId: string) => Promise<void>;
  onLeaveSharedList?: (shareId: string) => Promise<void>;
  loadingLists?: boolean;
}

export default function MobileNavWrapper({
  groceryLists,
  sharedGroceryLists,
  selectedListId,
  onSelectList,
  onCreateList,
  onRenameList,
  onDeleteList,
  onAcceptShare,
  onDeclineShare,
  onLeaveSharedList,
  loadingLists,
}: MobileNavWrapperProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      {/* Top Navigation */}
      <MobileNav onMenuClick={() => setIsSidebarOpen(true)} />

      {/* Sidebar Drawer */}
      <Suspense fallback={null}>
        <MobileSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          groceryLists={groceryLists}
          sharedGroceryLists={sharedGroceryLists}
          selectedListId={selectedListId}
          onSelectList={onSelectList}
          onCreateList={onCreateList}
          onRenameList={onRenameList}
          onDeleteList={onDeleteList}
          onAcceptShare={onAcceptShare}
          onDeclineShare={onDeclineShare}
          onLeaveSharedList={onLeaveSharedList}
          loadingLists={loadingLists}
        />
      </Suspense>

      {/* Bottom Navigation */}
      <BottomNav />
    </>
  );
}
