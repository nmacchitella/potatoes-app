'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { mealPlanApi, socialApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import { CalendarView } from '@/components/calendar';
import { ShareModal } from '@/components/sharing';
import type { MealPlanShare, UserSearchResult } from '@/types';

export default function CalendarPage() {
  // Calendar sharing state
  const [isCalendarShareModalOpen, setIsCalendarShareModalOpen] = useState(false);
  const [calendarShares, setCalendarShares] = useState<MealPlanShare[]>([]);
  const [loadingCalendarShares, setLoadingCalendarShares] = useState(false);
  const [calendarUserSearchQuery, setCalendarUserSearchQuery] = useState('');
  const [calendarUserSearchResults, setCalendarUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingCalendarUsers, setSearchingCalendarUsers] = useState(false);
  const [sharingCalendarUser, setSharingCalendarUser] = useState<string | null>(null);

  // Calendar sharing handlers
  const loadCalendarShares = async () => {
    setLoadingCalendarShares(true);
    try {
      const data = await mealPlanApi.listShares();
      setCalendarShares(data);
    } catch (error) {
      console.error('Failed to load calendar shares:', error);
    } finally {
      setLoadingCalendarShares(false);
    }
  };

  const openCalendarShareModal = () => {
    setIsCalendarShareModalOpen(true);
    loadCalendarShares();
  };

  // Calendar user search
  useEffect(() => {
    if (!calendarUserSearchQuery.trim()) {
      setCalendarUserSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingCalendarUsers(true);
      try {
        const results = await socialApi.searchUsers(calendarUserSearchQuery, 10);
        const shareUserIds = new Set(calendarShares.map(s => s.shared_with.id));
        setCalendarUserSearchResults(results.filter(u => !shareUserIds.has(u.id)));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchingCalendarUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [calendarUserSearchQuery, calendarShares]);

  const handleShareCalendar = async (userId: string, permission: 'viewer' | 'editor' = 'viewer') => {
    setSharingCalendarUser(userId);
    try {
      const newShare = await mealPlanApi.share({ user_id: userId, permission });
      setCalendarShares(prev => [...prev, newShare]);
      setCalendarUserSearchQuery('');
      setCalendarUserSearchResults([]);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to share calendar');
    } finally {
      setSharingCalendarUser(null);
    }
  };

  const handleUpdateCalendarSharePermission = async (userId: string, permission: 'viewer' | 'editor') => {
    try {
      const updated = await mealPlanApi.updateShare(userId, { permission });
      setCalendarShares(prev => prev.map(s => s.shared_with.id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemoveCalendarShare = async (userId: string) => {
    if (!confirm('Remove this user from your meal plan?')) return;
    try {
      await mealPlanApi.removeShare(userId);
      setCalendarShares(prev => prev.filter(s => s.shared_with.id !== userId));
    } catch (error) {
      console.error('Failed to remove share:', error);
    }
  };

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* Left Sidebar */}
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
                <div
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left bg-gold/10 text-gold-dark font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Meal Plan</span>
                </div>
                <Link
                  href="/grocery"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors text-charcoal hover:bg-cream-dark"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Grocery List</span>
                </Link>
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
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <CalendarView isActive={true} onOpenShareModal={openCalendarShareModal} />
          </main>
        </div>
      </div>

      {/* Calendar Share Modal */}
      <ShareModal
        isOpen={isCalendarShareModalOpen}
        onClose={() => {
          setIsCalendarShareModalOpen(false);
          setCalendarUserSearchQuery('');
          setCalendarUserSearchResults([]);
        }}
        title="Share Meal Plan"
        shares={calendarShares.map(s => ({
          id: s.id,
          user_id: s.shared_with.id,
          user: s.shared_with,
          permission: s.permission,
        }))}
        loadingShares={loadingCalendarShares}
        searchQuery={calendarUserSearchQuery}
        onSearchQueryChange={setCalendarUserSearchQuery}
        searchResults={calendarUserSearchResults}
        searching={searchingCalendarUsers}
        sharingUserId={sharingCalendarUser}
        onShareWithUser={handleShareCalendar}
        onUpdatePermission={handleUpdateCalendarSharePermission}
        onRemoveShare={handleRemoveCalendarShare}
      />
    </div>
  );
}
