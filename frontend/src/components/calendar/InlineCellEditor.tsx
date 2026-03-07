'use client';

import { useState, useEffect, useRef } from 'react';
import { searchApi, mealPlanApi } from '@/lib/api';
import { formatDateForApi } from '@/lib/calendar-utils';
import type { SearchRecipeResult, MealType, MealPlan } from '@/types';

interface InlineCellEditorProps {
  date: Date;
  mealType: MealType;
  calendarId: string;
  defaultServings: number;
  onMealCreated: (meal: MealPlan) => void;
  onClose: () => void;
  initialValue?: string;
}

export default function InlineCellEditor({
  date, mealType, calendarId, defaultServings, onMealCreated, onClose, initialValue = '',
}: InlineCellEditorProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SearchRecipeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setSelectedIndex(-1);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.autocomplete(query, 6);
        setResults([...(data.my_recipes || []), ...(data.discover_recipes || [])]);
        setSelectedIndex(-1);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const selectRecipe = async (recipe: SearchRecipeResult) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const meal = await mealPlanApi.create({
        calendar_id: calendarId,
        recipe_id: recipe.id,
        planned_date: formatDateForApi(date),
        meal_type: mealType,
        servings: defaultServings,
      });
      onMealCreated(meal);
    } catch (err) {
      console.error('Failed to add meal:', err);
      setSubmitting(false);
    }
  };

  const createCustom = async () => {
    if (submitting || !query.trim()) return;
    setSubmitting(true);
    try {
      const meal = await mealPlanApi.create({
        calendar_id: calendarId,
        custom_title: query.trim(),
        planned_date: formatDateForApi(date),
        meal_type: mealType,
        servings: defaultServings,
      });
      onMealCreated(meal);
    } catch (err) {
      console.error('Failed to create custom meal:', err);
      setSubmitting(false);
    }
  };

  const showCustomOption = query.trim().length >= 1;
  const totalItems = results.length + (showCustomOption ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        selectRecipe(results[selectedIndex]);
      } else if (showCustomOption) {
        createCustom();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Tab' && results.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      if (selectedIndex === -1) {
        setSelectedIndex(0);
      } else if (selectedIndex < results.length) {
        selectRecipe(results[selectedIndex]);
      }
    }
  };

  return (
    <div className="relative w-full min-h-[80px] flex flex-col justify-center" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(onClose, 150)}
        placeholder="Type to search..."
        className="w-full px-2 py-1.5 text-xs border-2 border-gold rounded-lg outline-none bg-white placeholder-warm-gray"
        disabled={submitting}
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="animate-spin rounded-full h-3 w-3 border border-gold border-t-transparent" />
        </div>
      )}

      {(results.length > 0 || showCustomOption) && !submitting && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-border z-50 max-h-[220px] overflow-y-auto">
          {results.map((recipe, index) => (
            <button
              key={recipe.id}
              onMouseDown={(e) => { e.preventDefault(); selectRecipe(recipe); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${
                selectedIndex === index ? 'bg-gold/10 text-charcoal' : 'text-charcoal hover:bg-cream'
              }`}
            >
              <span className="truncate font-medium">{recipe.title}</span>
            </button>
          ))}

          {showCustomOption && (
            <button
              onMouseDown={(e) => { e.preventDefault(); createCustom(); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors border-t border-border ${
                selectedIndex === results.length ? 'bg-sage/10' : 'hover:bg-cream'
              }`}
            >
              <svg className="w-3 h-3 text-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-charcoal truncate">
                Add &ldquo;<strong>{query.trim()}</strong>&rdquo; as custom
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
