'use client';

import type { MealPlan } from '@/types';

type CalendarViewMode = 'day' | 'week' | 'month';

interface ClipboardState {
  meal: MealPlan;
  action: 'copy' | 'cut';
}

interface CalendarHeaderProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  headerText: string;
  isCurrentPeriod: boolean;
  clipboard: ClipboardState | null;
  onClearClipboard: () => void;
  onGoToToday: () => void;
  onGoPrevious: () => void;
  onGoNext: () => void;
  onOpenShareModal: () => void;
  onOpenCopyWeeksModal: () => void;
}

export default function CalendarHeader({
  viewMode,
  onViewModeChange,
  headerText,
  isCurrentPeriod,
  clipboard,
  onClearClipboard,
  onGoToToday,
  onGoPrevious,
  onGoNext,
  onOpenShareModal,
  onOpenCopyWeeksModal,
}: CalendarHeaderProps) {
  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden mb-4">
        <h1 className="font-serif text-2xl text-charcoal text-center">Meal Plan</h1>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Meal Plan</h1>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-cream-dark rounded-lg p-1">
          {(['day', 'week', 'month'] as CalendarViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                viewMode === mode ? 'bg-white text-charcoal shadow-sm' : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenShareModal}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg text-charcoal hover:border-gold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Share
          </button>
          {!isCurrentPeriod && (
            <button onClick={onGoToToday} className="px-3 py-1.5 text-sm text-gold hover:text-gold-dark transition-colors">
              Today
            </button>
          )}
          {viewMode === 'week' && (
            <button
              onClick={onOpenCopyWeeksModal}
              className="p-2 text-warm-gray hover:text-charcoal transition-colors"
              title="Copy this week to future weeks"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          <button onClick={onGoPrevious} className="p-2 text-warm-gray hover:text-charcoal hover:bg-cream-dark rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-charcoal min-w-[180px] text-center">
            {headerText}
          </span>
          <button onClick={onGoNext} className="p-2 text-warm-gray hover:text-charcoal hover:bg-cream-dark rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Clipboard indicator */}
      {clipboard && (
        <div className="mb-4 p-3 bg-gold/10 border border-gold/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-charcoal">
              <strong>{clipboard.meal.recipe?.title || clipboard.meal.custom_title}</strong> {clipboard.action === 'copy' ? 'copied' : 'cut'} — click a slot to paste
            </span>
          </div>
          <button onClick={onClearClipboard} className="text-warm-gray hover:text-charcoal text-sm">
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
