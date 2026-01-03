'use client';

import type { Tag } from '@/types';

interface RecipeFilterSectionProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  availableTags: Tag[];
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
  tagFilterMode: 'all' | 'any';
  onToggleTagFilterMode: () => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
}

export default function RecipeFilterSection({
  searchQuery,
  onSearchQueryChange,
  availableTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  tagFilterMode,
  onToggleTagFilterMode,
  viewMode,
  onViewModeChange,
}: RecipeFilterSectionProps) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="relative inline-flex items-center">
          <svg
            className="w-4 h-4 text-warm-gray/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Filter by name..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-charcoal placeholder:text-warm-gray/50 pl-2 pr-6 py-1 w-40 focus:w-64 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="absolute right-0 text-warm-gray/60 hover:text-charcoal"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
        </div>

        {/* View Mode Toggle */}
        <div className="hidden md:flex items-center gap-1 bg-cream-dark rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-charcoal shadow-sm'
                : 'text-warm-gray hover:text-charcoal'
            }`}
            title="Grid view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-charcoal shadow-sm'
                : 'text-warm-gray hover:text-charcoal'
            }`}
            title="Table view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tag Pills with AND/OR Toggle */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {availableTags.map(tag => (
            <button
              key={tag.id}
              onClick={() => onToggleTag(tag.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedTags.includes(tag.id)
                  ? 'bg-gold text-white'
                  : 'bg-cream-dark text-charcoal hover:bg-gold/20'
              }`}
            >
              {tag.name}
            </button>
          ))}
          {selectedTags.length > 1 && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
              <span className="text-xs text-warm-gray">Match:</span>
              <div className="flex rounded-md overflow-hidden border border-border">
                <button
                  onClick={() => tagFilterMode !== 'all' && onToggleTagFilterMode()}
                  className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                    tagFilterMode === 'all'
                      ? 'bg-gold text-white'
                      : 'bg-cream text-charcoal hover:bg-cream-dark'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => tagFilterMode !== 'any' && onToggleTagFilterMode()}
                  className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                    tagFilterMode === 'any'
                      ? 'bg-gold text-white'
                      : 'bg-cream text-charcoal hover:bg-cream-dark'
                  }`}
                >
                  Any
                </button>
              </div>
            </div>
          )}
          {selectedTags.length > 0 && (
            <button
              onClick={onClearTags}
              className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
