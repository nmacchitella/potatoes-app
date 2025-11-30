'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi, tagApi } from '@/lib/api';
import { IngredientAutocomplete, UnitAutocomplete } from '@/components/recipes/IngredientAutocomplete';
import type { RecipeWithScale, RecipeIngredientInput, RecipeInstructionInput, Tag } from '@/types';

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState(4);
  const [yieldUnit, setYieldUnit] = useState('servings');
  const [prepTime, setPrepTime] = useState<number | ''>('');
  const [cookTime, setCookTime] = useState<number | ''>('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [privacyLevel, setPrivacyLevel] = useState<'private' | 'public'>('private');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('published');

  // Ingredients
  const [ingredients, setIngredients] = useState<RecipeIngredientInput[]>([]);

  // Instructions
  const [instructions, setInstructions] = useState<RecipeInstructionInput[]>([]);

  // Tags
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [recipe, tags] = await Promise.all([
          recipeApi.get(recipeId),
          tagApi.list(),
        ]);

        // Populate form
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setYieldQuantity(recipe.yield_quantity);
        setYieldUnit(recipe.yield_unit);
        setPrepTime(recipe.prep_time_minutes || '');
        setCookTime(recipe.cook_time_minutes || '');
        setDifficulty(recipe.difficulty || '');
        setPrivacyLevel(recipe.privacy_level);
        setSourceUrl(recipe.source_url || '');
        setSourceName(recipe.source_name || '');
        setCoverImageUrl(recipe.cover_image_url || '');
        setStatus(recipe.status);

        setIngredients(recipe.ingredients.map(ing => ({
          sort_order: ing.sort_order,
          quantity: ing.quantity,
          quantity_max: ing.quantity_max,
          unit: ing.unit,
          name: ing.name,
          preparation: ing.preparation,
          is_optional: ing.is_optional,
          is_staple: ing.is_staple,
          ingredient_group: ing.ingredient_group,
          notes: ing.notes,
        })));

        setInstructions(recipe.instructions.map(inst => ({
          step_number: inst.step_number,
          instruction_text: inst.instruction_text,
          duration_minutes: inst.duration_minutes,
          instruction_group: inst.instruction_group,
        })));

        setSelectedTagIds(recipe.tags.map(t => t.id));
        setAvailableTags(tags);
      } catch (err) {
        console.error('Failed to load recipe:', err);
        router.push('/recipes');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [recipeId, router]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', sort_order: ingredients.length }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredientInput, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addInstruction = () => {
    setInstructions([...instructions, { step_number: instructions.length + 1, instruction_text: '' }]);
  };

  const removeInstruction = (index: number) => {
    const updated = instructions.filter((_, i) => i !== index);
    setInstructions(updated.map((inst, i) => ({ ...inst, step_number: i + 1 })));
  };

  const updateInstruction = (index: number, text: string) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], instruction_text: text };
    setInstructions(updated);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    setError('');
    setSaving(true);

    try {
      await recipeApi.update(recipeId, {
        title,
        description: description || undefined,
        yield_quantity: yieldQuantity,
        yield_unit: yieldUnit,
        prep_time_minutes: prepTime || undefined,
        cook_time_minutes: cookTime || undefined,
        difficulty: difficulty || undefined,
        privacy_level: privacyLevel,
        source_url: sourceUrl || undefined,
        source_name: sourceName || undefined,
        cover_image_url: coverImageUrl || undefined,
        status,
        ingredients: ingredients.filter(i => i.name).map((ing, idx) => ({
          ...ing,
          sort_order: idx,
        })),
        instructions: instructions.filter(i => i.instruction_text).map((inst, idx) => ({
          ...inst,
          step_number: idx + 1,
        })),
        tag_ids: selectedTagIds,
      });

      router.push(`/recipes/${recipeId}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update recipe');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg p-8">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-dark-hover rounded w-1/4 mb-8" />
            <div className="card">
              <div className="h-10 bg-dark-hover rounded mb-4" />
              <div className="h-24 bg-dark-hover rounded mb-4" />
              <div className="h-10 bg-dark-hover rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/recipes/${recipeId}`} className="text-gray-400 hover:text-primary text-sm mb-2 inline-block">
            &larr; Cancel
          </Link>
          <h1 className="text-3xl font-bold">Edit Recipe</h1>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Basics */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Basic Info</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="input-field w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Servings</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={yieldQuantity}
                    onChange={e => setYieldQuantity(Number(e.target.value))}
                    min="1"
                    className="input-field w-24"
                  />
                  <input
                    type="text"
                    value={yieldUnit}
                    onChange={e => setYieldUnit(e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as any)}
                  className="input-field w-full"
                >
                  <option value="">Select...</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Prep Time (min)</label>
                <input
                  type="number"
                  value={prepTime}
                  onChange={e => setPrepTime(e.target.value ? Number(e.target.value) : '')}
                  min="0"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cook Time (min)</label>
                <input
                  type="number"
                  value={cookTime}
                  onChange={e => setCookTime(e.target.value ? Number(e.target.value) : '')}
                  min="0"
                  className="input-field w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Cover Image URL</label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={e => setCoverImageUrl(e.target.value)}
                placeholder="https://..."
                className="input-field w-full"
              />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Ingredients</h2>
          <div className="space-y-3">
            {ingredients.map((ing, index) => (
              <div key={index} className="flex gap-2 items-start">
                <input
                  type="number"
                  value={ing.quantity || ''}
                  onChange={e => updateIngredient(index, 'quantity', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Qty"
                  className="input-field w-20"
                  step="0.25"
                  min="0.01"
                />
                <UnitAutocomplete
                  value={ing.unit || ''}
                  onChange={value => updateIngredient(index, 'unit', value)}
                  placeholder="Unit"
                  className="w-24"
                />
                <IngredientAutocomplete
                  value={ing.name}
                  onChange={value => updateIngredient(index, 'name', value)}
                  placeholder="Ingredient name"
                  className="flex-1"
                />
                <input
                  type="text"
                  value={ing.preparation || ''}
                  onChange={e => updateIngredient(index, 'preparation', e.target.value)}
                  placeholder="Prep"
                  className="input-field w-28"
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="text-gray-400 hover:text-red-400 p-2"
                >
                  &times;
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
          </div>
        </div>

        {/* Instructions */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <div className="space-y-4">
            {instructions.map((inst, index) => (
              <div key={index} className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center mt-2">
                  {index + 1}
                </span>
                <textarea
                  value={inst.instruction_text}
                  onChange={e => updateInstruction(index, e.target.value)}
                  placeholder="Describe this step..."
                  rows={2}
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeInstruction(index)}
                  className="text-gray-400 hover:text-red-400 p-2 mt-2"
                >
                  &times;
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
        </div>

        {/* Organization */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Organization</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Privacy</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="privacy"
                    checked={privacyLevel === 'private'}
                    onChange={() => setPrivacyLevel('private')}
                  />
                  <span>Private</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="privacy"
                    checked={privacyLevel === 'public'}
                    onChange={() => setPrivacyLevel('public')}
                  />
                  <span>Public</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                  />
                  <span>Draft</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'published'}
                    onChange={() => setStatus('published')}
                  />
                  <span>Published</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? 'bg-primary text-black'
                        : 'bg-dark-hover text-gray-300 hover:bg-dark-card'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href={`/recipes/${recipeId}`} className="btn-secondary">
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || !title}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
