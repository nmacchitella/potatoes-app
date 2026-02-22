'use client';

import { useState, useEffect } from 'react';
import { mealPlanApi, socialApi, getErrorMessage } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MainNavigation from '@/components/layout/MainNavigation';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import { CalendarView } from '@/components/calendar';
import { MealPlanSidebar } from '@/components/calendar/MealPlanSidebar';
import { ShareModal } from '@/components/sharing';
import { useCalendar } from '@/hooks/useCalendar';
import type { MealPlanCalendarShare, UserSearchResult } from '@/types';

export default function CalendarPage() {
  const calendar = useCalendar(true);

  // Calendar sharing state
  const [isCalendarShareModalOpen, setIsCalendarShareModalOpen] = useState(false);
  const [selectedCalendarForSharing, setSelectedCalendarForSharing] = useState<string | null>(null);
  const [calendarShares, setCalendarShares] = useState<MealPlanCalendarShare[]>([]);
  const [loadingCalendarShares, setLoadingCalendarShares] = useState(false);
  const [calendarUserSearchQuery, setCalendarUserSearchQuery] = useState('');
  const [calendarUserSearchResults, setCalendarUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingCalendarUsers, setSearchingCalendarUsers] = useState(false);
  const [sharingCalendarUser, setSharingCalendarUser] = useState<string | null>(null);

  // Find selected calendar name for share modal title
  const selectedCalendarForSharingName = calendar.calendars.find(
    c => c.id === selectedCalendarForSharing
  )?.name || 'Meal Plan';

  // Calendar sharing handlers
  const loadCalendarShares = async (calendarId: string) => {
    setLoadingCalendarShares(true);
    try {
      const data = await mealPlanApi.listCalendarShares(calendarId);
      setCalendarShares(data);
    } catch (error) {
      console.error('Failed to load calendar shares:', error);
    } finally {
      setLoadingCalendarShares(false);
    }
  };

  const openCalendarShareModal = (calendarId?: string) => {
    // Use provided calendarId or default to first owned calendar
    const targetCalendarId = calendarId || calendar.calendars.find(c => c.is_owner)?.id;
    if (!targetCalendarId) return;

    setSelectedCalendarForSharing(targetCalendarId);
    setIsCalendarShareModalOpen(true);
    loadCalendarShares(targetCalendarId);
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
        const shareUserIds = new Set(calendarShares.map(s => s.user.id));
        setCalendarUserSearchResults(results.filter(u => !shareUserIds.has(u.id)));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchingCalendarUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [calendarUserSearchQuery, calendarShares]);

  const handleShareCalendar = async (userId: string, permission: 'viewer' | 'editor' = 'editor') => {
    if (!selectedCalendarForSharing) return;
    setSharingCalendarUser(userId);
    try {
      const newShare = await mealPlanApi.shareCalendar(selectedCalendarForSharing, { user_id: userId, permission });
      setCalendarShares(prev => [...prev, newShare]);
      setCalendarUserSearchQuery('');
      setCalendarUserSearchResults([]);
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'Failed to share calendar'));
    } finally {
      setSharingCalendarUser(null);
    }
  };

  const handleUpdateCalendarSharePermission = async (userId: string, permission: 'viewer' | 'editor') => {
    if (!selectedCalendarForSharing) return;
    try {
      const updated = await mealPlanApi.updateCalendarShare(selectedCalendarForSharing, userId, { permission });
      setCalendarShares(prev => prev.map(s => s.user.id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemoveCalendarShare = async (userId: string) => {
    if (!selectedCalendarForSharing) return;
    if (!confirm('Remove this user from your meal plan?')) return;
    try {
      await mealPlanApi.removeCalendarShare(selectedCalendarForSharing, userId);
      setCalendarShares(prev => prev.filter(s => s.user.id !== userId));
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
          {/* Left Sidebar - Navigation + Calendars */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              <MainNavigation currentPage="calendar" />

              {/* Calendar sidebar */}
              <MealPlanSidebar
                calendars={calendar.calendars}
                selectedCalendarIds={calendar.selectedCalendarIds}
                onToggleCalendar={calendar.toggleCalendar}
                onSelectAllCalendars={calendar.selectAllCalendars}
                onCreateCalendar={calendar.createCalendar}
                onRenameCalendar={calendar.renameCalendar}
                onDeleteCalendar={calendar.deleteCalendar}
                onLeaveCalendar={calendar.leaveCalendar}
                loading={calendar.calendarsLoading}
              />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <CalendarView
              isActive={true}
              onOpenShareModal={() => openCalendarShareModal()}
              calendarHook={calendar}
            />
          </main>
        </div>
      </div>

      {/* Calendar Share Modal */}
      <ShareModal
        isOpen={isCalendarShareModalOpen}
        onClose={() => {
          setIsCalendarShareModalOpen(false);
          setSelectedCalendarForSharing(null);
          setCalendarUserSearchQuery('');
          setCalendarUserSearchResults([]);
        }}
        title={`Share "${selectedCalendarForSharingName}"`}
        shares={calendarShares.map(s => ({
          id: s.id,
          user_id: s.user.id,
          user: s.user,
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
