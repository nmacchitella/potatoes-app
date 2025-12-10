'use client';

import { useState } from 'react';
import { IngredientAutocomplete, UnitAutocomplete } from './IngredientAutocomplete';
import type { RecipeIngredientInput } from '@/types';

interface RecipeIngredientsEditProps {
  ingredients: RecipeIngredientInput[];
  onChange: (ingredients: RecipeIngredientInput[]) => void;
  compact?: boolean;
  showPasteToggle?: boolean;
  onParsePaste?: (text: string) => Promise<RecipeIngredientInput[]>;
}

export function RecipeIngredientsEdit({
  ingredients,
  onChange,
  compact = false,
  showPasteToggle = false,
  onParsePaste,
}: RecipeIngredientsEditProps) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);

  const addIngredient = () => {
    onChange([...ingredients, { name: '', sort_order: ingredients.length }]);
  };

  const removeIngredient = (index: number) => {
    onChange(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredientInput, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleParsePaste = async () => {
    if (!pasteText.trim() || !onParsePaste) return;
    setParsing(true);
    try {
      const parsed = await onParsePaste(pasteText);
      const existingWithContent = ingredients.filter(i => i.name);
      onChange([...existingWithContent, ...parsed]);
      setPasteText('');
      setPasteMode(false);
    } catch (error) {
      console.error('Failed to parse ingredients:', error);
    } finally {
      setParsing(false);
    }
  };

  const renderPasteMode = () => (
    <div className="space-y-3">
      <textarea
        value={pasteText}
        onChange={e => setPasteText(e.target.value)}
        placeholder="Paste ingredients, one per line..."
        rows={compact ? 6 : 8}
        className={compact ? "input-field w-full font-mono text-sm" : "input-field w-full font-mono text-sm"}
      />
      <button
        type="button"
        onClick={handleParsePaste}
        disabled={parsing || !pasteText.trim()}
        className="btn-primary text-sm disabled:opacity-50"
      >
        {parsing ? 'Parsing...' : 'Parse'}
      </button>
    </div>
  );

  const renderToggle = () => (
    showPasteToggle && onParsePaste && (
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setPasteMode(!pasteMode)}
          className="text-xs text-gold hover:text-gold-dark"
        >
          {pasteMode ? 'Manual entry' : 'Paste list'}
        </button>
      </div>
    )
  );

  if (compact) {
    return (
      <div className="space-y-2">
        {renderToggle()}
        {pasteMode ? renderPasteMode() : (
          <>
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 group">
                <input
                  type="text"
                  value={ing.quantity?.toString() || ''}
                  onChange={e => updateIngredient(idx, 'quantity', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Qty"
                  className="w-10 sm:w-14 text-xs bg-cream rounded px-1.5 sm:px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none"
                />
                <UnitAutocomplete
                  value={ing.unit || ''}
                  onChange={value => updateIngredient(idx, 'unit', value || undefined)}
                  placeholder="unit"
                  className="w-14 sm:w-20"
                  compact
                />
                <IngredientAutocomplete
                  value={ing.name}
                  onChange={value => updateIngredient(idx, 'name', value)}
                  placeholder="Ingredient"
                  className="flex-1 min-w-0"
                  compact
                />
                <input
                  type="text"
                  value={ing.preparation || ''}
                  onChange={e => updateIngredient(idx, 'preparation', e.target.value || undefined)}
                  placeholder="prep"
                  className="hidden sm:block w-20 text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none"
                />
                <button
                  onClick={() => removeIngredient(idx)}
                  className="text-warm-gray hover:text-red-500 flex-shrink-0 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={addIngredient}
              className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 mt-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add ingredient
            </button>
          </>
        )}
      </div>
    );
  }

  // Full editing style
  return (
    <div className="space-y-3">
      {renderToggle()}
      {pasteMode ? renderPasteMode() : (
        <>
          {ingredients.map((ing, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="number"
                value={ing.quantity || ''}
                onChange={e => updateIngredient(index, 'quantity', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Qty"
                className="input-field w-20"
                step="0.25"
                min="0"
              />
              <UnitAutocomplete
                value={ing.unit || ''}
                onChange={value => updateIngredient(index, 'unit', value || undefined)}
                placeholder="Unit"
                className="w-24"
              />
              <IngredientAutocomplete
                value={ing.name}
                onChange={value => updateIngredient(index, 'name', value)}
                placeholder="Ingredient"
                className="flex-1"
              />
              <input
                type="text"
                value={ing.preparation || ''}
                onChange={e => updateIngredient(index, 'preparation', e.target.value || undefined)}
                placeholder="Prep"
                className="input-field w-28 hidden md:block"
              />
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="text-warm-gray hover:text-red-500 p-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredient}
            className="text-gold hover:text-gold-dark text-sm font-medium"
          >
            + Add ingredient
          </button>
        </>
      )}
    </div>
  );
}
