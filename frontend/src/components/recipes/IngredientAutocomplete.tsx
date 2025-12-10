'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ingredientApi } from '@/lib/api';
import { useClickOutside } from '@/hooks';
import type { Ingredient, MeasurementUnit } from '@/types';

interface IngredientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSelect?: (ingredient: Ingredient) => void;
  compact?: boolean;
}

export function IngredientAutocomplete({
  value,
  onChange,
  placeholder = 'Ingredient name',
  className = '',
  onSelect,
  compact = false,
}: IngredientAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside container
  useClickOutside(containerRef, useCallback(() => setShowSuggestions(false), []), showSuggestions);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const results = await ingredientApi.list(value, undefined, 10);
        setSuggestions(results);
      } catch (error) {
        console.error('Failed to fetch ingredients:', error);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(debounceTimer);
  }, [value]);

  const handleSelect = (ingredient: Ingredient) => {
    onChange(ingredient.name);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    onSelect?.(ingredient);
  };

  const handleCreateNew = async () => {
    if (!value.trim()) return;

    try {
      const newIngredient = await ingredientApi.create(value.trim());
      onSelect?.(newIngredient);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Failed to create ingredient:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > -1 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        } else if (highlightedIndex === suggestions.length) {
          handleCreateNew();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const exactMatch = suggestions.some(
    s => s.name.toLowerCase() === value.toLowerCase()
  );

  // Extract width class from className for the container, rest goes to input
  const widthMatch = className.match(/(?:^|\s)(w-\S+|flex-\d+|flex-1)/);
  const widthClass = widthMatch ? widthMatch[1] : '';
  const inputClasses = className.replace(/(?:^|\s)(w-\S+|flex-\d+|flex-1)/g, '').trim();

  const inputStyle = compact
    ? `text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none w-full ${inputClasses}`
    : `input-field w-full ${inputClasses}`;

  return (
    <div ref={containerRef} className={`relative ${widthClass}`}>
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => value.length >= 2 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputStyle}
        autoComplete="off"
      />

      {showSuggestions && (suggestions.length > 0 || value.length >= 2) && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((ingredient, index) => (
            <button
              key={ingredient.id}
              type="button"
              onClick={() => handleSelect(ingredient)}
              className={`w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-cream transition-colors flex justify-between items-center ${
                index === highlightedIndex ? 'bg-cream' : ''
              }`}
            >
              <span>{ingredient.name}</span>
              {ingredient.category && (
                <span className="text-xs text-warm-gray">{ingredient.category}</span>
              )}
            </button>
          ))}

          {value.length >= 2 && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateNew}
              className={`w-full px-4 py-2 text-left text-sm text-gold hover:bg-cream transition-colors border-t border-border ${
                highlightedIndex === suggestions.length ? 'bg-cream' : ''
              }`}
            >
              + Add "{value}" as new ingredient
            </button>
          )}

          {suggestions.length === 0 && value.length >= 2 && exactMatch && (
            <div className="px-4 py-2 text-sm text-warm-gray">
              No matching ingredients
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface UnitAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export function UnitAutocomplete({
  value,
  onChange,
  placeholder = 'Unit',
  className = '',
  compact = false,
}: UnitAutocompleteProps) {
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside container
  useClickOutside(containerRef, useCallback(() => setShowSuggestions(false), []), showSuggestions);

  useEffect(() => {
    ingredientApi.getUnits().then(setUnits).catch(console.error);
  }, []);

  const filteredUnits = units.filter(
    unit =>
      unit.name.toLowerCase().includes(value.toLowerCase()) ||
      (unit.abbreviation?.toLowerCase().includes(value.toLowerCase()))
  );

  const handleSelect = (unit: MeasurementUnit) => {
    onChange(unit.name);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredUnits.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredUnits.length) {
          handleSelect(filteredUnits[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Extract width class from className for the container, rest goes to input
  const widthMatch = className.match(/(?:^|\s)(w-\S+|flex-\d+|flex-1)/);
  const widthClass = widthMatch ? widthMatch[1] : '';
  const inputClasses = className.replace(/(?:^|\s)(w-\S+|flex-\d+|flex-1)/g, '').trim();

  const inputStyle = compact
    ? `text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none w-full ${inputClasses}`
    : `input-field w-full ${inputClasses}`;

  return (
    <div ref={containerRef} className={`relative ${widthClass}`}>
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputStyle}
        autoComplete="off"
      />

      {showSuggestions && filteredUnits.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredUnits.map((unit, index) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => handleSelect(unit)}
              className={`w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-cream transition-colors ${
                index === highlightedIndex ? 'bg-cream' : ''
              }`}
            >
              <span>{unit.name}</span>
              {unit.abbreviation && (
                <span className="text-warm-gray ml-2">({unit.abbreviation})</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
