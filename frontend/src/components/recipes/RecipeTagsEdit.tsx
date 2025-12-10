'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { tagApi } from '@/lib/api';
import { useClickOutside } from '@/hooks';
import type { Tag } from '@/types';

interface RecipeTagsEditProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  compact?: boolean;
}

export function RecipeTagsEdit({
  selectedTagIds,
  onChange,
  compact = false,
}: RecipeTagsEditProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, useCallback(() => setShowPicker(false), []), showPicker);

  useEffect(() => {
    tagApi.list().then(setAvailableTags).catch(console.error);
  }, []);

  const toggleTag = (tagId: string) => {
    onChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter(id => id !== tagId)
        : [...selectedTagIds, tagId]
    );
  };

  const selectedTags = availableTags.filter(t => selectedTagIds.includes(t.id));

  if (compact) {
    return (
      <div className="relative" ref={containerRef}>
        <div
          onClick={() => setShowPicker(!showPicker)}
          className="flex flex-wrap gap-1.5 min-h-[28px] cursor-pointer border border-border rounded p-1.5"
        >
          {selectedTags.length > 0 ? (
            selectedTags.map(tag => (
              <span
                key={tag.id}
                className="bg-gold/15 text-gold-dark px-2 py-0.5 rounded text-xs flex items-center gap-1"
              >
                {tag.name}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    toggleTag(tag.id);
                  }}
                  className="hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <span className="text-xs text-warm-gray">Click to add tags...</span>
          )}
        </div>
        {showPicker && (
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
            {availableTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-cream transition-colors ${
                  selectedTagIds.includes(tag.id) ? 'bg-gold/10 text-gold-dark' : 'text-charcoal'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full editing style - pill buttons
  return (
    <div className="flex flex-wrap gap-2">
      {availableTags.map(tag => (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggleTag(tag.id)}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            selectedTagIds.includes(tag.id)
              ? 'bg-gold text-white'
              : 'bg-cream-dark text-charcoal hover:bg-cream-dark/80'
          }`}
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}
