'use client';

import { useState } from 'react';
import { getSeasonalProduce, getMonthName } from '@/data/seasonalProduce';

export default function InSeasonWidget() {
  const [isExpanded, setIsExpanded] = useState(true);
  const month = new Date().getMonth() + 1;
  const produce = getSeasonalProduce(month);
  const monthName = getMonthName(month);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-1 py-1.5 text-left group"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span className="text-xs font-sans font-semibold uppercase tracking-wider text-warm-gray">
            In Season
          </span>
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
        <div className="mt-1 px-1">
          <p className="text-[11px] text-warm-gray-light mb-2.5">{monthName}</p>

          {/* Fruits */}
          <div className="mb-2.5">
            <p className="text-[11px] font-sans font-medium text-warm-gray mb-1.5">Fruits</p>
            <div className="flex flex-wrap gap-1">
              {produce.fruits.map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-[11px] text-charcoal rounded-md border border-amber-100"
                >
                  <span>{item.emoji}</span>
                  <span>{item.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Vegetables */}
          <div>
            <p className="text-[11px] font-sans font-medium text-warm-gray mb-1.5">Vegetables</p>
            <div className="flex flex-wrap gap-1">
              {produce.vegetables.map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-[11px] text-charcoal rounded-md border border-green-100"
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
