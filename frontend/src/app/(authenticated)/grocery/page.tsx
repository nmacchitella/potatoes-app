'use client';

import { GroceryListView } from '@/components/grocery';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';

export default function GroceryListPage() {
  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
        <GroceryListView />
      </main>
    </div>
  );
}
