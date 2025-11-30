'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi, tagApi } from '@/lib/api';
import { IngredientAutocomplete, UnitAutocomplete } from '@/components/recipes/IngredientAutocomplete';
import type { RecipeIngredientInput, RecipeInstructionInput, Tag, ParsedIngredient, RecipeImportResponse } from '@/types';

// Form data structure for each recipe tab
interface RecipeFormData {
  title: string;
  description: string;
  yieldQuantity: number;
  yieldUnit: string;
  prepTime: number | '';
  cookTime: number | '';
  difficulty: 'easy' | 'medium' | 'hard' | '';
  privacyLevel: 'private' | 'public';
  sourceUrl: string;
  coverImageUrl: string;
  ingredients: RecipeIngredientInput[];
  instructions: RecipeInstructionInput[];
  selectedTagIds: string[];
}

const createEmptyFormData = (): RecipeFormData => ({
  title: '',
  description: '',
  yieldQuantity: 4,
  yieldUnit: 'servings',
  prepTime: '',
  cookTime: '',
  difficulty: '',
  privacyLevel: 'private',
  sourceUrl: '',
  coverImageUrl: '',
  ingredients: [{ name: '', sort_order: 0 }],
  instructions: [{ step_number: 1, instruction_text: '' }],
  selectedTagIds: [],
});

const importResponseToFormData = (data: RecipeImportResponse): RecipeFormData => ({
  title: data.title,
  description: data.description || '',
  yieldQuantity: data.yield_quantity,
  yieldUnit: data.yield_unit,
  prepTime: data.prep_time_minutes || '',
  cookTime: data.cook_time_minutes || '',
  difficulty: (data.difficulty as 'easy' | 'medium' | 'hard') || '',
  privacyLevel: 'private',
  sourceUrl: data.source_url || '',
  coverImageUrl: data.cover_image_url || '',
  ingredients: data.ingredients.length > 0
    ? data.ingredients.map((ing, idx) => ({
        name: ing.name,
        quantity: ing.quantity,
        quantity_max: ing.quantity_max,
        unit: ing.unit,
        preparation: ing.preparation,
        is_optional: ing.is_optional,
        notes: ing.notes,
        sort_order: idx,
      }))
    : [{ name: '', sort_order: 0 }],
  instructions: data.instructions.length > 0
    ? data.instructions.map(inst => ({
        step_number: inst.step_number,
        instruction_text: inst.instruction_text,
        duration_minutes: inst.duration_minutes,
      }))
    : [{ step_number: 1, instruction_text: '' }],
  selectedTagIds: [],
});

export default function NewRecipePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Import state
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  // Multi-recipe tabs state
  const [recipeTabs, setRecipeTabs] = useState<RecipeFormData[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isImportedMode, setIsImportedMode] = useState(false);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    basics: true,
    ingredients: true,
    instructions: true,
  });

  // Tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Current form state (for single recipe or manual entry)
  const [formData, setFormData] = useState<RecipeFormData>(createEmptyFormData());

  // Paste mode for ingredients
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    tagApi.list().then(setAvailableTags).catch(console.error);
  }, []);

  // Get current form data (from tabs or single form)
  const currentFormData = recipeTabs.length > 0 ? recipeTabs[activeTabIndex] : formData;

  // Update form data helper
  const updateCurrentForm = useCallback(<K extends keyof RecipeFormData>(
    field: K,
    value: RecipeFormData[K]
  ) => {
    if (recipeTabs.length > 0) {
      setRecipeTabs(prev => prev.map((tab, idx) =>
        idx === activeTabIndex ? { ...tab, [field]: value } : tab
      ));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  }, [recipeTabs.length, activeTabIndex]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addIngredient = () => {
    const newIngredients = [...currentFormData.ingredients, { name: '', sort_order: currentFormData.ingredients.length }];
    updateCurrentForm('ingredients', newIngredients);
  };

  const removeIngredient = (index: number) => {
    const newIngredients = currentFormData.ingredients.filter((_, i) => i !== index);
    updateCurrentForm('ingredients', newIngredients);
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredientInput, value: any) => {
    const updated = [...currentFormData.ingredients];
    updated[index] = { ...updated[index], [field]: value };
    updateCurrentForm('ingredients', updated);
  };

  const addInstruction = () => {
    const newInstructions = [...currentFormData.instructions, { step_number: currentFormData.instructions.length + 1, instruction_text: '' }];
    updateCurrentForm('instructions', newInstructions);
  };

  const removeInstruction = (index: number) => {
    const updated = currentFormData.instructions.filter((_, i) => i !== index);
    const renumbered = updated.map((inst, i) => ({ ...inst, step_number: i + 1 }));
    updateCurrentForm('instructions', renumbered);
  };

  const updateInstruction = (index: number, text: string) => {
    const updated = [...currentFormData.instructions];
    updated[index] = { ...updated[index], instruction_text: text };
    updateCurrentForm('instructions', updated);
  };

  const handleParseIngredients = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      const result = await recipeApi.parseIngredients(pasteText);
      const parsed = result.ingredients.map((ing: ParsedIngredient, idx: number) => ({
        name: ing.name,
        quantity: ing.quantity,
        quantity_max: ing.quantity_max,
        unit: ing.unit,
        preparation: ing.preparation,
        notes: ing.notes,
        sort_order: currentFormData.ingredients.length + idx,
      }));
      const newIngredients = [...currentFormData.ingredients.filter(i => i.name), ...parsed];
      updateCurrentForm('ingredients', newIngredients);
      setPasteText('');
      setPasteMode(false);
    } catch (error) {
      console.error('Failed to parse ingredients:', error);
    } finally {
      setParsing(false);
    }
  };

  const toggleTag = (tagId: string) => {
    const newTags = currentFormData.selectedTagIds.includes(tagId)
      ? currentFormData.selectedTagIds.filter(id => id !== tagId)
      : [...currentFormData.selectedTagIds, tagId];
    updateCurrentForm('selectedTagIds', newTags);
  };

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
    !currentFormData.selectedTagIds.includes(tag.id)
  );

  const handleInlineImport = async () => {
    if (!importUrl.trim()) {
      setImportError('Please enter a URL');
      return;
    }

    try {
      new URL(importUrl);
    } catch {
      setImportError('Please enter a valid URL');
      return;
    }

    setImporting(true);
    setImportError('');

    try {
      const data = await recipeApi.importFromUrl(importUrl);

      if (data.recipes.length === 1) {
        // Single recipe - populate form
        setFormData(importResponseToFormData(data.recipes[0]));
        setIsImportedMode(true);
        setImportUrl('');
      } else if (data.recipes.length > 1) {
        // Multiple recipes - create tabs
        const tabs = data.recipes.map(recipe => importResponseToFormData(recipe));
        setRecipeTabs(tabs);
        setActiveTabIndex(0);
        setIsImportedMode(true);
        setImportUrl('');
      } else {
        setImportError('No recipes found at this URL.');
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to import recipe. Please try a different URL.';
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleDismissTab = (indexToRemove: number) => {
    const newTabs = recipeTabs.filter((_, idx) => idx !== indexToRemove);

    if (newTabs.length === 0) {
      // No more tabs - reset to initial state
      setRecipeTabs([]);
      setFormData(createEmptyFormData());
      setIsImportedMode(false);
      setActiveTabIndex(0);
    } else {
      setRecipeTabs(newTabs);
      // Adjust active tab if needed
      if (activeTabIndex >= newTabs.length) {
        setActiveTabIndex(newTabs.length - 1);
      } else if (indexToRemove < activeTabIndex) {
        setActiveTabIndex(activeTabIndex - 1);
      }
    }
  };

  const handleSubmit = async (status: 'draft' | 'published') => {
    setError('');
    setSaving(true);

    const data = currentFormData;

    try {
      const recipe = await recipeApi.create({
        title: data.title,
        description: data.description || undefined,
        yield_quantity: data.yieldQuantity,
        yield_unit: data.yieldUnit,
        prep_time_minutes: data.prepTime || undefined,
        cook_time_minutes: data.cookTime || undefined,
        difficulty: data.difficulty || undefined,
        privacy_level: data.privacyLevel,
        source_url: data.sourceUrl || undefined,
        cover_image_url: data.coverImageUrl || undefined,
        status,
        ingredients: data.ingredients.filter(i => i.name).map((ing, idx) => ({
          ...ing,
          sort_order: idx,
        })),
        instructions: data.instructions.filter(i => i.instruction_text).map((inst, idx) => ({
          ...inst,
          step_number: idx + 1,
        })),
        tag_ids: data.selectedTagIds,
      });

      // If we have multiple tabs, remove this one and show success
      if (recipeTabs.length > 1) {
        setImportMessage(`"${data.title}" saved!`);
        setTimeout(() => setImportMessage(''), 3000);
        handleDismissTab(activeTabIndex);
        setSaving(false);
      } else {
        // Single recipe - navigate to it
        router.push(`/recipes/${recipe.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create recipe');
      setSaving(false);
    }
  };

  const canSave = currentFormData.title.length >= 1 &&
    currentFormData.ingredients.some(i => i.name) &&
    currentFormData.instructions.some(i => i.instruction_text);

  return (
    <div className="min-h-screen bg-dark-bg p-4 md:p-8">
      {importMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {importMessage}
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/recipes" className="text-gray-400 hover:text-primary text-sm mb-1 inline-block">
              &larr; Back to Recipes
            </Link>
            <h1 className="text-2xl font-bold">
              {isImportedMode ? 'Review Recipe' : 'New Recipe'}
              {recipeTabs.length > 1 && ` (${activeTabIndex + 1}/${recipeTabs.length})`}
            </h1>
          </div>
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={saving || !currentFormData.title}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSubmit('published')}
              disabled={saving || !canSave}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Publish'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Import from URL - inline (only show when not in imported mode) */}
        {!isImportedMode && (
          <>
            <div className="card mb-4">
              <h3 className="font-medium mb-3">Import from URL</h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={importUrl}
                  onChange={e => {
                    setImportUrl(e.target.value);
                    setImportError('');
                  }}
                  onKeyDown={e => e.key === 'Enter' && !importing && handleInlineImport()}
                  placeholder="Paste a recipe link or YouTube video URL..."
                  className="input-field flex-1 py-2 text-sm"
                  disabled={importing}
                />
                <button
                  onClick={handleInlineImport}
                  disabled={importing || !importUrl.trim()}
                  className="btn-primary px-4 disabled:opacity-50"
                >
                  {importing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    'Import'
                  )}
                </button>
              </div>
              {importError && (
                <p className="text-red-400 text-sm mt-2">{importError}</p>
              )}
              {importing && (
                <p className="text-gray-400 text-sm mt-2">Importing recipe... This may take a few seconds.</p>
              )}
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 border-t border-dark-border" />
              <span className="text-gray-500 text-sm font-medium">OR</span>
              <div className="flex-1 border-t border-dark-border" />
            </div>
          </>
        )}

        {/* Recipe Tabs (only show when multiple recipes) */}
        {recipeTabs.length > 1 && (
          <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
            {recipeTabs.map((tab, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2 cursor-pointer transition-colors min-w-0 ${
                  index === activeTabIndex
                    ? 'bg-dark-card border-primary text-white'
                    : 'bg-dark-bg border-transparent text-gray-400 hover:text-white hover:bg-dark-card/50'
                }`}
              >
                <button
                  onClick={() => setActiveTabIndex(index)}
                  className="truncate max-w-[150px] text-sm font-medium text-left"
                  title={tab.title || `Recipe ${index + 1}`}
                >
                  {tab.title || `Recipe ${index + 1}`}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismissTab(index);
                  }}
                  className="text-gray-500 hover:text-red-400 flex-shrink-0"
                  title="Dismiss this recipe"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {/* Basics Section */}
          <div className="card">
            <button
              onClick={() => toggleSection('basics')}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-semibold">Details</h2>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.basics ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedSections.basics && (
              <div className="mt-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={currentFormData.title}
                    onChange={e => updateCurrentForm('title', e.target.value)}
                    placeholder="Recipe name"
                    className="input-field w-full py-2"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                  <textarea
                    value={currentFormData.description}
                    onChange={e => updateCurrentForm('description', e.target.value)}
                    placeholder="Brief description..."
                    rows={4}
                    className="input-field w-full"
                  />
                </div>

                {/* Compact row: Servings, Difficulty, Times */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Servings</label>
                    <input
                      type="number"
                      value={currentFormData.yieldQuantity}
                      onChange={e => updateCurrentForm('yieldQuantity', Number(e.target.value))}
                      min="1"
                      className="input-field w-full py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Unit</label>
                    <input
                      type="text"
                      value={currentFormData.yieldUnit}
                      onChange={e => updateCurrentForm('yieldUnit', e.target.value)}
                      className="input-field w-full py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Prep (min)</label>
                    <input
                      type="number"
                      value={currentFormData.prepTime}
                      onChange={e => updateCurrentForm('prepTime', e.target.value ? Number(e.target.value) : '')}
                      min="0"
                      className="input-field w-full py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Cook (min)</label>
                    <input
                      type="number"
                      value={currentFormData.cookTime}
                      onChange={e => updateCurrentForm('cookTime', e.target.value ? Number(e.target.value) : '')}
                      min="0"
                      className="input-field w-full py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Difficulty</label>
                    <select
                      value={currentFormData.difficulty}
                      onChange={e => updateCurrentForm('difficulty', e.target.value as any)}
                      className="input-field w-full py-1.5 text-sm"
                    >
                      <option value="">-</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                {/* Privacy & Tags row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Privacy</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="privacy"
                          checked={currentFormData.privacyLevel === 'private'}
                          onChange={() => updateCurrentForm('privacyLevel', 'private')}
                          className="text-primary"
                        />
                        Private
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="privacy"
                          checked={currentFormData.privacyLevel === 'public'}
                          onChange={() => updateCurrentForm('privacyLevel', 'public')}
                          className="text-primary"
                        />
                        Public
                      </label>
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {currentFormData.selectedTagIds.map(id => {
                        const tag = availableTags.find(t => t.id === id);
                        return tag ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-0.5 rounded text-xs"
                          >
                            {tag.name}
                            <button onClick={() => toggleTag(id)} className="hover:text-white">&times;</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                    <input
                      type="text"
                      value={tagSearch}
                      onChange={e => setTagSearch(e.target.value)}
                      onFocus={() => setShowTagDropdown(true)}
                      onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
                      placeholder="Search tags..."
                      className="input-field w-full py-1.5 text-sm"
                    />
                    {showTagDropdown && filteredTags.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-dark-card border border-dark-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                        {filteredTags.slice(0, 8).map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => {
                              toggleTag(tag.id);
                              setTagSearch('');
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-dark-hover"
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cover image (only for imported) and source */}
                {isImportedMode && currentFormData.coverImageUrl ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Cover Image URL</label>
                      <input
                        type="url"
                        value={currentFormData.coverImageUrl}
                        onChange={e => updateCurrentForm('coverImageUrl', e.target.value)}
                        placeholder="https://..."
                        className="input-field w-full py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Source URL</label>
                      <input
                        type="url"
                        value={currentFormData.sourceUrl}
                        onChange={e => updateCurrentForm('sourceUrl', e.target.value)}
                        placeholder="Original recipe link"
                        className="input-field w-full py-1.5 text-sm"
                      />
                    </div>
                  </div>
                ) : currentFormData.sourceUrl ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Source URL</label>
                    <input
                      type="url"
                      value={currentFormData.sourceUrl}
                      onChange={e => updateCurrentForm('sourceUrl', e.target.value)}
                      placeholder="Original recipe link"
                      className="input-field w-full py-1.5 text-sm"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Ingredients Section */}
          <div className="card">
            <button
              onClick={() => toggleSection('ingredients')}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-semibold">Ingredients</h2>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.ingredients ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedSections.ingredients && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => setPasteMode(!pasteMode)}
                    className="text-xs text-primary hover:underline"
                  >
                    {pasteMode ? 'Manual entry' : 'Paste list'}
                  </button>
                </div>

                {pasteMode ? (
                  <div className="space-y-2">
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder="Paste ingredients, one per line..."
                      rows={8}
                      className="input-field w-full font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleParseIngredients}
                      disabled={parsing || !pasteText.trim()}
                      className="btn-primary text-sm"
                    >
                      {parsing ? 'Parsing...' : 'Parse'}
                    </button>
                  </div>
                ) : (
                  <>
                    {currentFormData.ingredients.map((ing, index) => (
                      <div key={index} className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          value={ing.quantity || ''}
                          onChange={e => updateIngredient(index, 'quantity', e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Qty"
                          className="input-field w-16 py-1.5 text-sm"
                          step="0.25"
                          min="0"
                        />
                        <UnitAutocomplete
                          value={ing.unit || ''}
                          onChange={value => updateIngredient(index, 'unit', value)}
                          placeholder="Unit"
                          className="w-20 py-1.5 text-sm"
                        />
                        <IngredientAutocomplete
                          value={ing.name}
                          onChange={value => updateIngredient(index, 'name', value)}
                          placeholder="Ingredient"
                          className="flex-1 py-1.5 text-sm"
                        />
                        <input
                          type="text"
                          value={ing.preparation || ''}
                          onChange={e => updateIngredient(index, 'preparation', e.target.value)}
                          placeholder="Prep"
                          className="input-field w-24 py-1.5 text-sm hidden md:block"
                        />
                        <button
                          type="button"
                          onClick={() => removeIngredient(index)}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addIngredient}
                      className="text-primary hover:underline text-sm"
                    >
                      + Add ingredient
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Instructions Section */}
          <div className="card">
            <button
              onClick={() => toggleSection('instructions')}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-semibold">Instructions</h2>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.instructions ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedSections.instructions && (
              <div className="mt-4 space-y-3">
                {currentFormData.instructions.map((inst, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-black text-sm font-bold flex items-center justify-center mt-1">
                      {index + 1}
                    </span>
                    <textarea
                      value={inst.instruction_text}
                      onChange={e => updateInstruction(index, e.target.value)}
                      placeholder="Describe this step..."
                      rows={3}
                      className="input-field flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeInstruction(index)}
                      className="text-gray-500 hover:text-red-400 p-1 mt-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addInstruction}
                  className="text-primary hover:underline text-sm"
                >
                  + Add step
                </button>
              </div>
            )}
          </div>

          {/* Bottom save buttons (all screen sizes) */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={saving || !currentFormData.title}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSubmit('published')}
              disabled={saving || !canSave}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
