'use client';

import { useState, useEffect } from 'react';
import { mealPlanApi, socialApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MainNavigation from '@/components/layout/MainNavigation';
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
              <MainNavigation currentPage="calendar" />
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
