'use client';

import { useState } from 'react';

// Helper functions to replace date-fns
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
  onGenerate: (startDate: string, endDate: string, merge: boolean) => Promise<void>;
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

  const [startDate, setStartDate] = useState(formatDate(thisWeekStart));
  const [endDate, setEndDate] = useState(formatDate(thisWeekEnd));
  const [merge, setMerge] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerate(startDate, endDate, merge);
  };

  const setThisWeek = () => {
    setStartDate(formatDate(thisWeekStart));
    setEndDate(formatDate(thisWeekEnd));
  };

  const setNextWeek = () => {
    const nextWeekStart = addDays(thisWeekStart, 7);
    const nextWeekEnd = addDays(thisWeekEnd, 7);
    setStartDate(formatDate(nextWeekStart));
    setEndDate(formatDate(nextWeekEnd));
  };

  const setNext7Days = () => {
    setStartDate(formatDate(today));
    setEndDate(formatDate(addDays(today, 6)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
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
    </div>
  );
}
