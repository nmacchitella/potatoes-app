'use client';

import { useState } from 'react';
import type { Tag } from '@/types';

const COLLAPSED_TAG_COUNT = 4;

interface RecipeFilterSectionProps {
  availableTags: Tag[];
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
  tagFilterMode: 'all' | 'any';
  onToggleTagFilterMode: () => void;
}

export default function RecipeFilterSection({
  availableTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  tagFilterMode,
  onToggleTagFilterMode,
}: RecipeFilterSectionProps) {
  const [tagsExpanded, setTagsExpanded] = useState(false);

  if (availableTags.length === 0) return null;

  const visibleTags = tagsExpanded
    ? availableTags
    : (() => {
        const selected = availableTags.filter(t => selectedTags.includes(t.id));
        const unselected = availableTags.filter(t => !selectedTags.includes(t.id));
        const slotsLeft = Math.max(0, COLLAPSED_TAG_COUNT - selected.length);
        return [...selected, ...unselected.slice(0, slotsLeft)];
      })();
  const hiddenCount = availableTags.length - visibleTags.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {availableTags.map(tag => (
        <button
          key={tag.id}
          onClick={() => onToggleTag(tag.id)}
          className={`hidden lg:inline-flex px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedTags.includes(tag.id)
              ? 'bg-gold text-white'
              : 'bg-cream-dark text-charcoal hover:bg-gold/20'
          }`}
        >
          {tag.name}
        </button>
      ))}
      {/* Mobile: collapsible */}
      {visibleTags.map(tag => (
        <button
          key={tag.id}
          onClick={() => onToggleTag(tag.id)}
          className={`lg:hidden px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedTags.includes(tag.id)
              ? 'bg-gold text-white'
              : 'bg-cream-dark text-charcoal hover:bg-gold/20'
          }`}
        >
          {tag.name}
        </button>
      ))}
      {hiddenCount > 0 && (
        <button
          onClick={() => setTagsExpanded(true)}
          className="lg:hidden px-2.5 py-1 rounded-full text-xs font-medium bg-cream-dark text-warm-gray hover:text-charcoal transition-colors"
        >
          +{hiddenCount} more
        </button>
      )}
      {tagsExpanded && availableTags.length > COLLAPSED_TAG_COUNT && (
        <button
          onClick={() => setTagsExpanded(false)}
          className="lg:hidden px-2.5 py-1 rounded-full text-xs font-medium text-warm-gray hover:text-charcoal transition-colors"
        >
          Show less
        </button>
      )}
      {selectedTags.length > 1 && (
        <div className="flex items-center gap-1 pl-2 border-l border-border">
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
  );
}
