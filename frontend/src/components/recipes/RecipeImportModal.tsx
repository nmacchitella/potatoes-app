'use client';

import { useState, useEffect } from 'react';
import { recipeApi, getErrorMessage } from '@/lib/api';
import { Modal } from '@/components/ui';
import type { RecipeImportResponse, RecipeImportMultiResponse } from '@/types';

interface RecipeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: RecipeImportResponse) => void;
  initialData?: RecipeImportMultiResponse | null;
}

export function RecipeImportModal({ isOpen, onClose, onImport, initialData }: RecipeImportModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [multipleRecipes, setMultipleRecipes] = useState<RecipeImportMultiResponse | null>(null);
  const [importedIndices, setImportedIndices] = useState<Set<number>>(new Set());

  // Set initial data when modal opens with pre-fetched recipes
  useEffect(() => {
    if (isOpen && initialData) {
      setMultipleRecipes(initialData);
    }
  }, [isOpen, initialData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setMultipleRecipes(null);
      setImportedIndices(new Set());
      setError('');
    }
  }, [isOpen]);

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await recipeApi.importFromUrl(url);

      // If single recipe, import directly
      if (data.recipes.length === 1) {
        onImport(data.recipes[0]);
        setUrl('');
        onClose();
      } else if (data.recipes.length > 1) {
        // Show recipe selection UI
        setMultipleRecipes(data);
      } else {
        setError('No recipes found at this URL.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to import recipe. Please try a different URL.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecipe = (recipe: RecipeImportResponse, index: number) => {
    onImport(recipe);
    setImportedIndices(prev => new Set(prev).add(index));
  };

  const handleImportAll = () => {
    if (!multipleRecipes) return;
    multipleRecipes.recipes.forEach((recipe, index) => {
      if (!importedIndices.has(index)) {
        onImport(recipe);
      }
    });
    // Mark all as imported
    setImportedIndices(new Set(multipleRecipes.recipes.map((_, i) => i)));
  };

  const handleDone = () => {
    setUrl('');
    setMultipleRecipes(null);
    setImportedIndices(new Set());
    onClose();
  };

  const handleBackToUrl = () => {
    // Only allow going back to URL input if we didn't come from pre-fetched data
    if (!initialData) {
      setMultipleRecipes(null);
      setImportedIndices(new Set());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleImport();
    }
  };

  // Recipe selection view when multiple recipes are found
  if (multipleRecipes && multipleRecipes.recipes.length > 1) {
    return (
      <Modal isOpen={isOpen} onClose={handleDone} size="2xl" blur>
        <div className="bg-white rounded-lg shadow-xl p-6 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            {!initialData && (
              <button
                onClick={handleBackToUrl}
                className="text-warm-gray hover:text-charcoal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-semibold">Select a Recipe</h2>
          </div>

          <p className="text-warm-gray text-sm mb-4">
            We found {multipleRecipes.recipes.length} recipes in this {multipleRecipes.source_type === 'youtube' ? 'video' : 'page'}.
            {importedIndices.size > 0
              ? ` ${importedIndices.size} imported. Select another or click Done.`
              : ' Click to import each one.'}
          </p>

          <div className="flex-1 overflow-y-auto space-y-3">
            {multipleRecipes.recipes.map((recipe, index) => {
              const isImported = importedIndices.has(index);
              return (
                <button
                  key={index}
                  onClick={() => handleSelectRecipe(recipe, index)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    isImported
                      ? 'bg-green-500/10 border-green-500/50'
                      : 'bg-cream hover:bg-cream-dark border-border hover:border-gold/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-charcoal mb-1">{recipe.title}</h3>
                      {recipe.description && (
                        <p className="text-warm-gray text-sm line-clamp-2 mb-2">{recipe.description}</p>
                      )}
                      <div className="flex gap-4 text-xs text-warm-gray">
                        <span>{recipe.ingredients.length} ingredients</span>
                        <span>{recipe.instructions.length} steps</span>
                        {recipe.prep_time_minutes && <span>{recipe.prep_time_minutes} min prep</span>}
                        {recipe.cook_time_minutes && <span>{recipe.cook_time_minutes} min cook</span>}
                      </div>
                    </div>
                    {isImported && (
                      <div className="flex-shrink-0 text-green-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleImportAll}
              className="btn-secondary"
              disabled={importedIndices.size === multipleRecipes.recipes.length}
            >
              {importedIndices.size === 0 ? 'Import All' : 'Import Remaining'}
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="btn-primary"
            >
              {importedIndices.size > 0 ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Default URL input view
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" blur>
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Import Recipe from URL</h2>

        <p className="text-warm-gray text-sm mb-4">
          Paste a link to a recipe or YouTube video and we'll automatically extract the ingredients,
          instructions, and other details for you to review and save.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Recipe URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com/recipe or YouTube video URL..."
              className="input-field w-full"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 text-warm-gray text-sm">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent" />
              <span>Importing recipe... This may take a few seconds.</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="btn-primary"
            disabled={loading || !url.trim()}
          >
            {loading ? 'Importing...' : 'Import Recipe'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
