'use client';

import { useState, Suspense } from 'react';
import MobileNav from './MobileNav';
import MobileSidebar from './MobileSidebar';
import BottomNav from './BottomNav';

export default function MobileNavWrapper() {
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
        />
      </Suspense>

      {/* Bottom Navigation */}
      <BottomNav />
    </>
  );
}
