'use client';

import { useState, useEffect } from 'react';
import { mealPlanApi } from '@/lib/api';
import { formatDateForApi, getStartOfWeek } from '@/lib/calendar-utils';
import { Modal } from '@/components/ui';
import type { MealPlanCalendar } from '@/types';

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (startDate: string, endDate: string, merge: boolean, calendarIds?: string[]) => Promise<void>;
  isGenerating: boolean;
  hasExistingItems: boolean;
}

export function GenerateModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
  hasExistingItems,
}: GenerateModalProps) {
  const today = new Date();
  const thisWeekStart = getStartOfWeek(today);
  const thisWeekEnd = getEndOfWeek(today);

  const [startDate, setStartDate] = useState(formatDateForApi(thisWeekStart));
  const [endDate, setEndDate] = useState(formatDateForApi(thisWeekEnd));
  const [merge, setMerge] = useState(false);

  // Calendar state
  const [calendars, setCalendars] = useState<MealPlanCalendar[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  // Fetch calendars when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingCalendars(true);
      mealPlanApi.listCalendars()
        .then(data => {
          setCalendars(data);
          // Select all calendars by default
          setSelectedCalendarIds(data.map(c => c.id));
        })
        .catch(err => console.error('Failed to fetch calendars:', err))
        .finally(() => setLoadingCalendars(false));
    }
  }, [isOpen]);

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds(prev => {
      if (prev.includes(calendarId)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== calendarId);
      }
      return [...prev, calendarId];
    });
  };

  const toggleAllCalendars = () => {
    if (selectedCalendarIds.length === calendars.length) {
      // If all selected, select only the first one (can't select none)
      setSelectedCalendarIds([calendars[0]?.id].filter(Boolean));
    } else {
      // Select all
      setSelectedCalendarIds(calendars.map(c => c.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerate(startDate, endDate, merge, selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined);
  };

  const setThisWeek = () => {
    setStartDate(formatDateForApi(thisWeekStart));
    setEndDate(formatDateForApi(thisWeekEnd));
  };

  const setNextWeek = () => {
    const nextWeekStart = addDays(thisWeekStart, 7);
    const nextWeekEnd = addDays(thisWeekEnd, 7);
    setStartDate(formatDateForApi(nextWeekStart));
    setEndDate(formatDateForApi(nextWeekEnd));
  };

  const setNext7Days = () => {
    setStartDate(formatDateForApi(today));
    setEndDate(formatDateForApi(addDays(today, 6)));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" ariaLabel="Generate Grocery List">
      <div className="bg-white rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-charcoal">Generate Grocery List</h2>
          <button
            onClick={onClose}
            className="p-1 text-warm-gray hover:text-charcoal transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-warm-gray">
            Generate a grocery list from your meal plan. Select a date range to include.
          </p>

          {/* Quick select buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={setThisWeek}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-warm-gray/5 transition-colors"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={setNextWeek}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-warm-gray/5 transition-colors"
            >
              Next Week
            </button>
            <button
              type="button"
              onClick={setNext7Days}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-warm-gray/5 transition-colors"
            >
              Next 7 Days
            </button>
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                required
              />
            </div>
          </div>

          {/* Calendar selection (only show if multiple calendars) */}
          {calendars.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-charcoal">
                  Include calendars
                </label>
                <button
                  type="button"
                  onClick={toggleAllCalendars}
                  className="text-xs text-gold hover:text-gold-dark"
                >
                  {selectedCalendarIds.length === calendars.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {loadingCalendars ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {calendars.map(calendar => (
                    <label
                      key={calendar.id}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-cream/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCalendarIds.includes(calendar.id)}
                        onChange={() => toggleCalendar(calendar.id)}
                        className="w-4 h-4 text-gold border-border rounded focus:ring-gold/50"
                      />
                      <span className="text-sm text-charcoal flex-1 truncate">
                        {calendar.name}
                        {!calendar.is_owner && calendar.owner && (
                          <span className="text-warm-gray ml-1">
                            ({calendar.owner.name})
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Merge option (only show if there are existing items) */}
          {hasExistingItems && (
            <div className="p-3 bg-warm-gray/5 rounded-lg">
              <p className="text-sm font-medium text-charcoal mb-2">
                You already have items in your list. What would you like to do?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="merge"
                    checked={!merge}
                    onChange={() => setMerge(false)}
                    className="w-4 h-4 text-gold focus:ring-gold"
                  />
                  <span className="text-sm text-charcoal">Replace existing list</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="merge"
                    checked={merge}
                    onChange={() => setMerge(true)}
                    className="w-4 h-4 text-gold focus:ring-gold"
                  />
                  <span className="text-sm text-charcoal">Merge with existing list</span>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-charcoal hover:bg-warm-gray/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate List'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
