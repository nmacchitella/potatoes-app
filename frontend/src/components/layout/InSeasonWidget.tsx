'use client';

import { useState } from 'react';
import { getSeasonalProduce, getMonthName } from '@/data/seasonalProduce';

export default function InSeasonWidget() {
  const [isExpanded, setIsExpanded] = useState(true);
  const month = new Date().getMonth() + 1;
  const produce = getSeasonalProduce(month);
  const monthName = getMonthName(month);

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-cream/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span className="text-xs font-sans font-semibold uppercase tracking-wider text-warm-gray">
            In Season
          </span>
          <span className="text-xs text-warm-gray-light">&mdash; {monthName}</span>
        </div>
        <svg
          className={`w-4 h-4 text-warm-gray-light transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/50">
          {/* Fruits */}
          <div className="pt-3">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-wider text-warm-gray mb-2">Fruits</p>
            <div className="flex flex-wrap gap-1">
              {produce.fruits.map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-xs text-charcoal rounded-full border border-amber-100 whitespace-nowrap"
                >
                  <span>{item.emoji}</span>
                  <span>{item.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Vegetables */}
          <div className="pt-3 sm:border-l sm:border-border/50 sm:pl-3">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-wider text-warm-gray mb-2">Vegetables</p>
            <div className="flex flex-wrap gap-1">
              {produce.vegetables.map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-xs text-charcoal rounded-full border border-green-100 whitespace-nowrap"
                >
                  <span>{item.emoji}</span>
                  <span>{item.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
