'use client';

import { useState, useEffect } from 'react';
import type { MealPlanCalendar } from '@/types';
import { getErrorMessage } from '@/lib/api';

interface MealPlanSidebarProps {
  calendars: MealPlanCalendar[];
  selectedCalendarIds: string[];
  onToggleCalendar: (calendarId: string) => void;
  onSelectAllCalendars: () => void;
  onCreateCalendar: (name?: string) => Promise<MealPlanCalendar>;
  onRenameCalendar: (calendarId: string, name: string) => Promise<void>;
  onDeleteCalendar: (calendarId: string) => Promise<void>;
  onLeaveCalendar: (calendarId: string) => Promise<void>;
  loading: boolean;
}

export function MealPlanSidebar({
  calendars,
  selectedCalendarIds,
  onToggleCalendar,
  onSelectAllCalendars,
  onCreateCalendar,
  onRenameCalendar,
  onDeleteCalendar,
  onLeaveCalendar,
  loading,
}: MealPlanSidebarProps) {
  const [isManageMode, setIsManageMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const myCalendars = calendars.filter(c => c.is_owner);
  const sharedCalendars = calendars.filter(c => !c.is_owner);
  const allSelected = calendars.length > 0 && selectedCalendarIds.length === calendars.length;

  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalendarName.trim()) return;
    setError(null);
    try {
      await onCreateCalendar(newCalendarName.trim());
      setNewCalendarName('');
      setIsCreating(false);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to create calendar');
      setError(message);
    }
  };

  const handleRenameCalendar = async (calendarId: string) => {
    if (!editingName.trim()) return;
    setError(null);
    try {
      await onRenameCalendar(calendarId, editingName.trim());
      setEditingCalendarId(null);
      setEditingName('');
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to rename calendar');
      setError(message);
    }
  };

  const handleDeleteCalendar = async (calendarId: string) => {
    setError(null);
    try {
      await onDeleteCalendar(calendarId);
      setShowDeleteConfirm(null);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to delete calendar');
      setError(message);
      setShowDeleteConfirm(null);
    }
  };

  const handleLeaveCalendar = async (calendarId: string) => {
    setError(null);
    try {
      await onLeaveCalendar(calendarId);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to leave calendar');
      setError(message);
    }
  };

  if (loading) {
    return (
      <nav className="flex flex-col max-h-[calc(100vh-10rem)]">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-cream-dark rounded w-24"></div>
          <div className="h-8 bg-cream-dark rounded"></div>
          <div className="h-8 bg-cream-dark rounded"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex flex-col max-h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-warm-gray uppercase tracking-wide">
            Calendars
          </span>
          {myCalendars.length > 0 && (
            <button
              onClick={() => setIsManageMode(!isManageMode)}
              className={`text-xs transition-colors ${isManageMode ? 'text-gold font-medium' : 'text-warm-gray hover:text-gold'}`}
            >
              {isManageMode ? 'Done' : 'Manage'}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Scrollable calendar list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
        {/* Select All option - only when not in manage mode */}
        {!isManageMode && calendars.length > 1 && (
          <button
            onClick={onSelectAllCalendars}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              allSelected
                ? 'bg-charcoal/5 text-charcoal font-medium'
                : 'hover:bg-cream-dark text-warm-gray'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              allSelected ? 'border-gold bg-gold' : 'border-warm-gray'
            }`}>
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm">All Calendars</span>
          </button>
        )}

        {calendars.length === 0 ? (
          <p className="px-3 py-2 text-sm text-warm-gray">
            No calendars yet
          </p>
        ) : (
          <>
            {/* Own calendars */}
            {myCalendars.map((calendar) => (
              <div key={calendar.id} className="group relative">
                {editingCalendarId === calendar.id ? (
                  <div className="flex items-center gap-1 px-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCalendar(calendar.id);
                        if (e.key === 'Escape') {
                          setEditingCalendarId(null);
                          setEditingName('');
                        }
                      }}
                      className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameCalendar(calendar.id)}
                      className="p-1 text-green-600 hover:text-green-700"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setEditingCalendarId(null); setEditingName(''); }}
                      className="p-1 text-warm-gray hover:text-charcoal"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : showDeleteConfirm === calendar.id ? (
                  <div className="p-2 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-700 mb-2">Delete &quot;{calendar.name}&quot;?</p>
                    <p className="text-xs text-red-600 mb-2">All meals in this calendar will be deleted.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteCalendar(calendar.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : isManageMode ? (
                  // Manage mode view
                  <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-cream-dark group/item">
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-charcoal">{calendar.name}</span>
                      {calendar.share_count > 0 && (
                        <span className="text-[10px] text-warm-gray">
                          Shared with {calendar.share_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingCalendarId(calendar.id);
                          setEditingName(calendar.name);
                        }}
                        className="p-1 text-warm-gray hover:text-gold"
                        title="Rename"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {myCalendars.length > 1 && (
                        <button
                          onClick={() => setShowDeleteConfirm(calendar.id)}
                          className="p-1 text-warm-gray hover:text-red-500"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  // Normal view with checkbox
                  <button
                    onClick={() => onToggleCalendar(calendar.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      selectedCalendarIds.includes(calendar.id)
                        ? 'bg-charcoal/5'
                        : 'hover:bg-cream-dark'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedCalendarIds.includes(calendar.id) ? 'border-gold bg-gold' : 'border-warm-gray'
                    }`}>
                      {selectedCalendarIds.includes(calendar.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm truncate ${selectedCalendarIds.includes(calendar.id) ? 'text-charcoal font-medium' : ''}`}>
                      {calendar.name}
                    </span>
                    {calendar.share_count > 0 && (
                      <span className="text-[10px] text-warm-gray bg-cream-dark px-1 rounded">
                        {calendar.share_count}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}

            {/* Shared calendars */}
            {sharedCalendars.length > 0 && (
              <>
                <div className="pt-3 pb-1">
                  <span className="text-[10px] font-medium text-warm-gray uppercase tracking-wide px-3">
                    Shared with me
                  </span>
                </div>
                {sharedCalendars.map((calendar) => (
                  <div key={calendar.id} className="group relative">
                    {isManageMode ? (
                      <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-cream-dark group/item">
                        <div className="flex-1 min-w-0">
                          <span className="block truncate text-charcoal">{calendar.name}</span>
                          <span className="text-[10px] text-warm-gray">by {calendar.owner?.name}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          {calendar.permission === 'viewer' && (
                            <span className="text-[10px] text-warm-gray" title="View only">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </span>
                          )}
                          <button
                            onClick={() => handleLeaveCalendar(calendar.id)}
                            className="p-1 text-warm-gray hover:text-red-500"
                            title="Leave calendar"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => onToggleCalendar(calendar.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                          selectedCalendarIds.includes(calendar.id)
                            ? 'bg-charcoal/5'
                            : 'hover:bg-cream-dark'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedCalendarIds.includes(calendar.id) ? 'border-gold bg-gold' : 'border-warm-gray'
                        }`}>
                          {selectedCalendarIds.includes(calendar.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 text-left">
                          <span className={`text-sm block truncate ${selectedCalendarIds.includes(calendar.id) ? 'text-charcoal font-medium' : ''}`}>
                            {calendar.name}
                          </span>
                          <span className="text-[10px] text-warm-gray">
                            by {calendar.owner?.name}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* Create new calendar */}
        {isCreating ? (
          <div className="flex items-center gap-1 px-2 mt-1">
            <input
              type="text"
              value={newCalendarName}
              onChange={(e) => setNewCalendarName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateCalendar(e as unknown as React.FormEvent);
                }
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewCalendarName('');
                }
              }}
              placeholder="Calendar name..."
              className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
              autoFocus
            />
            <button
              onClick={(e) => handleCreateCalendar(e as unknown as React.FormEvent)}
              disabled={!newCalendarName.trim()}
              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => { setIsCreating(false); setNewCalendarName(''); }}
              className="p-1 text-warm-gray hover:text-charcoal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="block w-full text-left px-3 py-2 text-sm text-gold hover:text-gold-dark"
          >
            + New Calendar
          </button>
        )}
      </div>
    </nav>
  );
}
