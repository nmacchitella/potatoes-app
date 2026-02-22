'use client';

import { useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import Link from 'next/link';
import { UI_CONFIG } from '@/lib/constants';

interface CarouselProps {
  title?: string;
  viewAllLink?: string;
  loading?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  /** Number of skeleton cards to show when loading */
  skeletonCount?: number;
}

/**
 * Carousel - Horizontal scrollable container with navigation arrows
 *
 * Usage:
 * ```tsx
 * <Carousel title="My Recipes" viewAllLink="/recipes">
 *   {recipes.map(recipe => (
 *     <RecipeCard key={recipe.id} recipe={recipe} variant="compact" />
 *   ))}
 * </Carousel>
 * ```
 */
export function Carousel({
  title,
  viewAllLink,
  loading = false,
  emptyMessage = 'No items to display',
  children,
  skeletonCount = 4,
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(checkScroll, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [children, checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -UI_CONFIG.CAROUSEL_SCROLL_AMOUNT : UI_CONFIG.CAROUSEL_SCROLL_AMOUNT,
        behavior: 'smooth'
      });
    }
  };

  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : children !== null && children !== undefined;

  return (
    <div className="mb-6">
      {(title || viewAllLink) && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {viewAllLink && hasChildren && !loading && (
              <Link href={viewAllLink} className="text-sm text-warm-gray hover:text-gold transition-colors">
                View all →
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="p-1.5 rounded-lg bg-white border border-border hover:border-gold/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="p-1.5 rounded-lg bg-white border border-border hover:border-gold/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-64 bg-white rounded-lg border border-border animate-pulse">
              <div className="h-36 bg-cream-dark" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-cream-dark rounded w-3/4" />
                <div className="h-3 bg-cream-dark rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : !hasChildren ? (
        <div className="bg-white rounded-lg border border-border p-8 text-center text-warm-gray">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 items-stretch"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Carousel;
