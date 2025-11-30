'use client';

import { useState, useEffect, useRef } from 'react';
import { ingredientApi } from '@/lib/api';
import type { Ingredient, MeasurementUnit } from '@/types';

interface IngredientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSelect?: (ingredient: Ingredient) => void;
}

export function IngredientAutocomplete({
  value,
  onChange,
  placeholder = 'Ingredient name',
  className = '',
  onSelect,
}: IngredientAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className={`relative ${widthClass}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => value.length >= 2 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`input-field w-full ${inputClasses}`}
        autoComplete="off"
      />

      {showSuggestions && (suggestions.length > 0 || value.length >= 2) && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-dark-card border border-dark-hover rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((ingredient, index) => (
            <button
              key={ingredient.id}
              type="button"
              onClick={() => handleSelect(ingredient)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-dark-hover transition-colors flex justify-between items-center ${
                index === highlightedIndex ? 'bg-dark-hover' : ''
              }`}
            >
              <span>{ingredient.name}</span>
              {ingredient.category && (
                <span className="text-xs text-gray-500">{ingredient.category}</span>
              )}
            </button>
          ))}

          {value.length >= 2 && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateNew}
              className={`w-full px-4 py-2 text-left text-sm text-primary hover:bg-dark-hover transition-colors border-t border-dark-hover ${
                highlightedIndex === suggestions.length ? 'bg-dark-hover' : ''
              }`}
            >
              + Add "{value}" as new ingredient
            </button>
          )}

          {suggestions.length === 0 && value.length >= 2 && exactMatch && (
            <div className="px-4 py-2 text-sm text-gray-500">
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
}

export function UnitAutocomplete({
  value,
  onChange,
  placeholder = 'Unit',
  className = '',
}: UnitAutocompleteProps) {
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ingredientApi.getUnits().then(setUnits).catch(console.error);
  }, []);

  const filteredUnits = units.filter(
    unit =>
      unit.name.toLowerCase().includes(value.toLowerCase()) ||
      (unit.abbreviation?.toLowerCase().includes(value.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className={`relative ${widthClass}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`input-field w-full ${inputClasses}`}
        autoComplete="off"
      />

      {showSuggestions && filteredUnits.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-dark-card border border-dark-hover rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredUnits.map((unit, index) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => handleSelect(unit)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-dark-hover transition-colors ${
                index === highlightedIndex ? 'bg-dark-hover' : ''
              }`}
            >
              <span>{unit.name}</span>
              {unit.abbreviation && (
                <span className="text-gray-500 ml-2">({unit.abbreviation})</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
