'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { recipeApi, tagApi, collectionApi } from '@/lib/api';
import { RecipeIngredientsEdit, RecipeInstructionsEdit } from '@/components/recipes';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { RecipeIngredientInput, RecipeInstructionInput, Tag, ParsedIngredient, RecipeImportResponse, Collection } from '@/types';

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

function NewRecipeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get('title') || '';
  const initialCollection = searchParams.get('collection') || '';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Collection state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(initialCollection);

  // Import state
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  // Paste recipe state
  const [recipePasteText, setRecipePasteText] = useState('');
  const [recipeParsing, setRecipeParsing] = useState(false);
  const [recipePasteError, setRecipePasteError] = useState('');

  // Multi-recipe tabs state
  const [recipeTabs, setRecipeTabs] = useState<RecipeFormData[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isImportedMode, setIsImportedMode] = useState(false);

  // Collapsible sections
  const [manualExpanded, setManualExpanded] = useState(!!initialTitle);
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
  const [formData, setFormData] = useState<RecipeFormData>(() => ({
    ...createEmptyFormData(),
    title: initialTitle,
  }));

  useEffect(() => {
    tagApi.list().then(setAvailableTags).catch(console.error);
    collectionApi.list().then(setCollections).catch(console.error);
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

  const handleParseIngredients = useCallback(async (text: string): Promise<RecipeIngredientInput[]> => {
    const result = await recipeApi.parseIngredients(text);
    return result.ingredients.map((ing: ParsedIngredient, idx: number) => ({
      name: ing.name,
      quantity: ing.quantity,
      quantity_max: ing.quantity_max,
      unit: ing.unit,
      preparation: ing.preparation,
      notes: ing.notes,
      sort_order: currentFormData.ingredients.length + idx,
    }));
  }, [currentFormData.ingredients.length]);

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
        setFormData(importResponseToFormData(data.recipes[0]));
        setIsImportedMode(true);
        setImportUrl('');
      } else if (data.recipes.length > 1) {
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

  const handlePasteRecipe = async () => {
    if (!recipePasteText.trim()) {
      setRecipePasteError('Please paste some recipe text');
      return;
    }

    if (recipePasteText.trim().length < 50) {
      setRecipePasteError('Please provide more recipe text (at least 50 characters)');
      return;
    }

    setRecipeParsing(true);
    setRecipePasteError('');

    try {
      const data = await recipeApi.parseFromText(recipePasteText);

      if (data.recipes.length === 1) {
        setFormData(importResponseToFormData(data.recipes[0]));
        setIsImportedMode(true);
        setRecipePasteText('');
      } else if (data.recipes.length > 1) {
        const tabs = data.recipes.map(recipe => importResponseToFormData(recipe));
        setRecipeTabs(tabs);
        setActiveTabIndex(0);
        setIsImportedMode(true);
        setRecipePasteText('');
      } else {
        setRecipePasteError('Could not extract a recipe from the text. Please try with more details.');
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to parse recipe. Please try again.';
      setRecipePasteError(message);
    } finally {
      setRecipeParsing(false);
    }
  };

  const handleDismissTab = (indexToRemove: number) => {
    const newTabs = recipeTabs.filter((_, idx) => idx !== indexToRemove);

    if (newTabs.length === 0) {
      setRecipeTabs([]);
      setFormData(createEmptyFormData());
      setIsImportedMode(false);
      setActiveTabIndex(0);
    } else {
      setRecipeTabs(newTabs);
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

      // Add to collection if one is selected
      if (selectedCollectionId) {
        try {
          await collectionApi.addRecipe(selectedCollectionId, recipe.id);
        } catch (err) {
          console.error('Failed to add recipe to collection:', err);
          // Don't block the flow if adding to collection fails
        }
      }

      if (recipeTabs.length > 1) {
        setImportMessage(`"${data.title}" saved!`);
        setTimeout(() => setImportMessage(''), 3000);
        handleDismissTab(activeTabIndex);
        setSaving(false);
      } else {
        // Redirect to collection view if recipe was added to a collection
        if (selectedCollectionId) {
          router.push(`/recipes?collection=${selectedCollectionId}`);
        } else {
          router.push(`/recipes/${recipe.id}`);
        }
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
    <div className="min-h-screen bg-cream py-8 px-4 md:px-8 has-bottom-nav">
      <MobileNavWrapper />
      {importMessage && (
        <div className="fixed top-4 right-4 z-50 bg-gold text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {importMessage}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-warm-gray hover:text-gold text-sm uppercase tracking-wider mb-4 inline-block">
            &larr; Back to Recipes
          </Link>
          <div className="flex items-end justify-between">
            <h1 className="font-serif text-4xl text-charcoal">
              {isImportedMode ? 'Review Recipe' : 'New Recipe'}
            </h1>
            {recipeTabs.length > 1 && (
              <span className="text-warm-gray text-sm">{activeTabIndex + 1} of {recipeTabs.length}</span>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Import from URL or Create Manually */}
        {!isImportedMode && (
          <div className="card mb-6">
            {/* Import from URL */}
            <div className="mb-6">
              <h3 className="font-serif text-xl text-charcoal mb-4">Import from URL</h3>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={importUrl}
                  onChange={e => {
                    setImportUrl(e.target.value);
                    setImportError('');
                  }}
                  onKeyDown={e => e.key === 'Enter' && !importing && handleInlineImport()}
                  placeholder="Paste a recipe link or YouTube video URL..."
                  className="input-field flex-1"
                  disabled={importing}
                />
                <button
                  onClick={handleInlineImport}
                  disabled={importing || !importUrl.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  {importing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    'Import'
                  )}
                </button>
              </div>
              {importError && (
                <p className="text-red-600 text-sm mt-3">{importError}</p>
              )}
              {importing && (
                <p className="text-warm-gray text-sm mt-3">Importing recipe... This may take a few seconds.</p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border my-6" />

            {/* Paste Recipe */}
            <div className="mb-6">
              <h3 className="font-serif text-xl text-charcoal mb-4">Paste Recipe</h3>
              <p className="text-warm-gray text-sm mb-3">
                Paste recipe text from any source and we'll extract the details automatically.
              </p>
              <textarea
                value={recipePasteText}
                onChange={e => {
                  setRecipePasteText(e.target.value);
                  setRecipePasteError('');
                }}
                placeholder="Paste your recipe here... Include the title, ingredients, and instructions."
                rows={6}
                className="input-field w-full font-mono text-sm mb-3"
                disabled={recipeParsing}
              />
              <button
                onClick={handlePasteRecipe}
                disabled={recipeParsing || !recipePasteText.trim()}
                className="btn-primary disabled:opacity-50"
              >
                {recipeParsing ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Parsing...
                  </span>
                ) : (
                  'Parse Recipe'
                )}
              </button>
              {recipePasteError && (
                <p className="text-red-600 text-sm mt-3">{recipePasteError}</p>
              )}
              {recipeParsing && (
                <p className="text-warm-gray text-sm mt-3">Analyzing your recipe... This may take a few seconds.</p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border my-6" />

            {/* Create Manually - Collapsible */}
            <div>
              <button
                onClick={() => setManualExpanded(!manualExpanded)}
                className="w-full flex items-center justify-between text-left"
              >
                <h3 className="font-serif text-xl text-charcoal">Create manually</h3>
                <svg
                  className={`w-5 h-5 text-warm-gray transition-transform ${manualExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {manualExpanded && (
                <div className="mt-6 space-y-6">
                  {/* Details Section */}
                  <div className="border border-border rounded-lg p-4">
                    <button
                      onClick={() => toggleSection('basics')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h4 className="font-medium text-charcoal">Details</h4>
                      <svg
                        className={`w-4 h-4 text-warm-gray transition-transform ${expandedSections.basics ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedSections.basics && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="label mb-2 block">Title *</label>
                          <input
                            type="text"
                            value={currentFormData.title}
                            onChange={e => updateCurrentForm('title', e.target.value)}
                            placeholder="Recipe name"
                            className="input-field w-full"
                          />
                        </div>

                        <div>
                          <label className="label mb-2 block">Description</label>
                          <textarea
                            value={currentFormData.description}
                            onChange={e => updateCurrentForm('description', e.target.value)}
                            placeholder="Brief description..."
                            rows={2}
                            className="input-field w-full"
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="label mb-1 block text-xs">Servings</label>
                            <input
                              type="number"
                              value={currentFormData.yieldQuantity}
                              onChange={e => updateCurrentForm('yieldQuantity', Number(e.target.value))}
                              min="1"
                              className="input-field w-full"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block text-xs">Prep (min)</label>
                            <input
                              type="number"
                              value={currentFormData.prepTime}
                              onChange={e => updateCurrentForm('prepTime', e.target.value ? Number(e.target.value) : '')}
                              min="0"
                              className="input-field w-full"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block text-xs">Cook (min)</label>
                            <input
                              type="number"
                              value={currentFormData.cookTime}
                              onChange={e => updateCurrentForm('cookTime', e.target.value ? Number(e.target.value) : '')}
                              min="0"
                              className="input-field w-full"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block text-xs">Difficulty</label>
                            <select
                              value={currentFormData.difficulty}
                              onChange={e => updateCurrentForm('difficulty', e.target.value as any)}
                              className="input-field w-full"
                            >
                              <option value="">-</option>
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                          <div>
                            <label className="label mb-1 block text-xs">Privacy</label>
                            <div className="flex gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                  type="radio"
                                  name="privacy"
                                  checked={currentFormData.privacyLevel === 'private'}
                                  onChange={() => updateCurrentForm('privacyLevel', 'private')}
                                  className="accent-gold"
                                />
                                <span className="text-charcoal">Private</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                  type="radio"
                                  name="privacy"
                                  checked={currentFormData.privacyLevel === 'public'}
                                  onChange={() => updateCurrentForm('privacyLevel', 'public')}
                                  className="accent-gold"
                                />
                                <span className="text-charcoal">Public</span>
                              </label>
                            </div>
                          </div>

                          {collections.length > 0 && (
                            <div className="flex-1 min-w-[150px]">
                              <label className="label mb-1 block text-xs">Collection</label>
                              <select
                                value={selectedCollectionId}
                                onChange={e => setSelectedCollectionId(e.target.value)}
                                className="input-field w-full"
                              >
                                <option value="">None</option>
                                {collections.map(collection => (
                                  <option key={collection.id} value={collection.id}>
                                    {collection.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <label className="label mb-1 block text-xs">Tags</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {currentFormData.selectedTagIds.map(id => {
                              const tag = availableTags.find(t => t.id === id);
                              return tag ? (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 bg-gold/10 text-gold border border-gold/30 px-2 py-0.5 rounded-full text-xs"
                                >
                                  {tag.name}
                                  <button onClick={() => toggleTag(id)} className="hover:text-gold-dark">&times;</button>
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
                            className="input-field w-full"
                          />
                          {showTagDropdown && filteredTags.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                              {filteredTags.slice(0, 8).map(tag => (
                                <button
                                  key={tag.id}
                                  onClick={() => {
                                    toggleTag(tag.id);
                                    setTagSearch('');
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-sm text-charcoal hover:bg-cream transition-colors"
                                >
                                  {tag.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ingredients Section */}
                  <div className="border border-border rounded-lg p-4">
                    <button
                      onClick={() => toggleSection('ingredients')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h4 className="font-medium text-charcoal">Ingredients</h4>
                      <svg
                        className={`w-4 h-4 text-warm-gray transition-transform ${expandedSections.ingredients ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedSections.ingredients && (
                      <div className="mt-4">
                        <RecipeIngredientsEdit
                          ingredients={currentFormData.ingredients}
                          onChange={ingredients => updateCurrentForm('ingredients', ingredients)}
                          showPasteToggle
                          onParsePaste={handleParseIngredients}
                        />
                      </div>
                    )}
                  </div>

                  {/* Instructions Section */}
                  <div className="border border-border rounded-lg p-4">
                    <button
                      onClick={() => toggleSection('instructions')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h4 className="font-medium text-charcoal">Method</h4>
                      <svg
                        className={`w-4 h-4 text-warm-gray transition-transform ${expandedSections.instructions ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedSections.instructions && (
                      <div className="mt-4">
                        <RecipeInstructionsEdit
                          instructions={currentFormData.instructions}
                          onChange={instructions => updateCurrentForm('instructions', instructions)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Save buttons for manual entry */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => router.push('/')}
                      disabled={saving}
                      className="btn-secondary flex-1 disabled:opacity-50"
                    >
                      Cancel
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
              )}
            </div>
          </div>
        )}

        {/* Imported Recipe Review */}
        {isImportedMode && (
          <>
            {/* Recipe Tabs */}
            {recipeTabs.length > 1 && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {recipeTabs.map((tab, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-colors ${
                      index === activeTabIndex
                        ? 'bg-gold text-white'
                        : 'bg-white border border-border text-charcoal hover:border-gold'
                    }`}
                  >
                    <button
                      onClick={() => setActiveTabIndex(index)}
                      className="truncate max-w-[120px] text-sm"
                      title={tab.title || `Recipe ${index + 1}`}
                    >
                      {tab.title || `Recipe ${index + 1}`}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissTab(index);
                      }}
                      className={`flex-shrink-0 ${index === activeTabIndex ? 'text-white/70 hover:text-white' : 'text-warm-gray hover:text-red-500'}`}
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

            <div className="space-y-6">
              {/* Details Section */}
              <div className="card">
                <button
                  onClick={() => toggleSection('basics')}
                  className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-serif text-2xl text-charcoal">Details</h2>
              <svg
                className={`w-5 h-5 text-warm-gray transition-transform ${expandedSections.basics ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedSections.basics && (
              <div className="mt-6 space-y-5">
                <div>
                  <label className="label mb-2 block">Title *</label>
                  <input
                    type="text"
                    value={currentFormData.title}
                    onChange={e => updateCurrentForm('title', e.target.value)}
                    placeholder="Recipe name"
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="label mb-2 block">Description</label>
                  <textarea
                    value={currentFormData.description}
                    onChange={e => updateCurrentForm('description', e.target.value)}
                    placeholder="Brief description..."
                    rows={3}
                    className="input-field w-full"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="label mb-2 block">Servings</label>
                    <input
                      type="number"
                      value={currentFormData.yieldQuantity}
                      onChange={e => updateCurrentForm('yieldQuantity', Number(e.target.value))}
                      min="1"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="label mb-2 block">Prep (min)</label>
                    <input
                      type="number"
                      value={currentFormData.prepTime}
                      onChange={e => updateCurrentForm('prepTime', e.target.value ? Number(e.target.value) : '')}
                      min="0"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="label mb-2 block">Cook (min)</label>
                    <input
                      type="number"
                      value={currentFormData.cookTime}
                      onChange={e => updateCurrentForm('cookTime', e.target.value ? Number(e.target.value) : '')}
                      min="0"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="label mb-2 block">Difficulty</label>
                    <select
                      value={currentFormData.difficulty}
                      onChange={e => updateCurrentForm('difficulty', e.target.value as any)}
                      className="input-field w-full"
                    >
                      <option value="">-</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-2 block">Privacy</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          checked={currentFormData.privacyLevel === 'private'}
                          onChange={() => updateCurrentForm('privacyLevel', 'private')}
                          className="accent-gold"
                        />
                        <span className="text-charcoal">Private</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          checked={currentFormData.privacyLevel === 'public'}
                          onChange={() => updateCurrentForm('privacyLevel', 'public')}
                          className="accent-gold"
                        />
                        <span className="text-charcoal">Public</span>
                      </label>
                    </div>
                  </div>
                  <div className="relative">
                    <label className="label mb-2 block">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {currentFormData.selectedTagIds.map(id => {
                        const tag = availableTags.find(t => t.id === id);
                        return tag ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 bg-gold/10 text-gold border border-gold/30 px-3 py-1 rounded-full text-sm"
                          >
                            {tag.name}
                            <button onClick={() => toggleTag(id)} className="hover:text-gold-dark">&times;</button>
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
                      className="input-field w-full"
                    />
                    {showTagDropdown && filteredTags.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                        {filteredTags.slice(0, 8).map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => {
                              toggleTag(tag.id);
                              setTagSearch('');
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-charcoal hover:bg-cream transition-colors"
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Collection Selector */}
                {collections.length > 0 && (
                  <div>
                    <label className="label mb-2 block">Add to Collection</label>
                    <select
                      value={selectedCollectionId}
                      onChange={e => setSelectedCollectionId(e.target.value)}
                      className="input-field w-full md:w-1/2"
                    >
                      <option value="">None</option>
                      {collections.map(collection => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isImportedMode && currentFormData.coverImageUrl && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-2 block">Cover Image URL</label>
                      <input
                        type="url"
                        value={currentFormData.coverImageUrl}
                        onChange={e => updateCurrentForm('coverImageUrl', e.target.value)}
                        placeholder="https://..."
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="label mb-2 block">Source URL</label>
                      <input
                        type="url"
                        value={currentFormData.sourceUrl}
                        onChange={e => updateCurrentForm('sourceUrl', e.target.value)}
                        placeholder="Original recipe link"
                        className="input-field w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ingredients Section */}
          <div className="card">
            <button
              onClick={() => toggleSection('ingredients')}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-serif text-2xl text-charcoal">Ingredients</h2>
              <svg
                className={`w-5 h-5 text-warm-gray transition-transform ${expandedSections.ingredients ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedSections.ingredients && (
              <div className="mt-6">
                <RecipeIngredientsEdit
                  ingredients={currentFormData.ingredients}
                  onChange={ingredients => updateCurrentForm('ingredients', ingredients)}
                  showPasteToggle
                  onParsePaste={handleParseIngredients}
                />
              </div>
            )}
          </div>

          {/* Instructions Section */}
          <div className="card">
            <button
              onClick={() => toggleSection('instructions')}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-serif text-2xl text-charcoal">Method</h2>
              <svg
                className={`w-5 h-5 text-warm-gray transition-transform ${expandedSections.instructions ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedSections.instructions && (
              <div className="mt-6">
                <RecipeInstructionsEdit
                  instructions={currentFormData.instructions}
                  onChange={instructions => updateCurrentForm('instructions', instructions)}
                />
              </div>
            )}
          </div>

          {/* Save buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => router.push('/')}
              disabled={saving}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Cancel
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
      </>
    )}
      </div>
    </div>
  );
}

export default function NewRecipePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-charcoal text-xl">Loading...</div>
      </div>
    }>
      <NewRecipeContent />
    </Suspense>
  );
}
