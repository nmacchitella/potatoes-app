'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi, collectionApi, tagApi, getErrorMessage } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { abbreviateUnit, formatQuantity } from '@/lib/constants';
import Navbar from '@/components/layout/Navbar';
import type { RecipeWithScale, Collection, RecipeIngredient, RecipeInstruction, Tag } from '@/types';

/**
 * Format an ingredient for display
 * Combines quantity, unit, name, and preparation into a readable string
 */
const formatIngredient = (ing: RecipeIngredient): string => {
  const parts: string[] = [];

  // Format quantity (with optional range)
  if (ing.quantity) {
    const qty = formatQuantity(ing.quantity);
    if (ing.quantity_max) {
      const qtyMax = formatQuantity(ing.quantity_max);
      parts.push(`${qty}-${qtyMax}`);
    } else {
      parts.push(qty);
    }
  }

  // Add unit (metric units attach directly to quantity)
  if (ing.unit) {
    const abbr = abbreviateUnit(ing.unit);
    if (abbr) {
      const metricUnits = ['g', 'kg', 'mg', 'ml', 'L'];
      if (metricUnits.includes(abbr)) {
        parts[parts.length - 1] = (parts[parts.length - 1] || '') + abbr;
      } else {
        parts.push(abbr);
      }
    }
  }

  // Add name and preparation
  parts.push(ing.name);
  if (ing.preparation) {
    parts[parts.length - 1] += `, ${ing.preparation}`;
  }

  return parts.join(' ');
};

// Editable ingredient type for form state
interface EditableIngredient {
  id: string;
  quantity: string;
  unit: string;
  name: string;
  preparation: string;
  is_optional: boolean;
}

interface EditableInstruction {
  id: string;
  step_number: number;
  instruction_text: string;
  duration_minutes: string;
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, fetchUserProfile } = useStore();
  const [recipe, setRecipe] = useState<RecipeWithScale | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    source_url: '',
    source_name: '',
    prep_time_minutes: '',
    cook_time_minutes: '',
    difficulty: '' as '' | 'easy' | 'medium' | 'hard',
    yield_quantity: '',
    yield_unit: '',
    cover_image_url: '',
    notes: '',
    privacy_level: 'private' as 'private' | 'public',
  });

  // Recipe collections
  const [recipeCollections, setRecipeCollections] = useState<Collection[]>([]);
  const [editIngredients, setEditIngredients] = useState<EditableIngredient[]>([]);
  const [editInstructions, setEditInstructions] = useState<EditableInstruction[]>([]);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Collection dropdown state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  const recipeId = params.id as string;

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    const fetchRecipe = async () => {
      setLoading(true);
      try {
        const data = await recipeApi.get(recipeId, scale !== 1 ? scale : undefined);
        setRecipe(data);
      } catch (error) {
        console.error('Failed to fetch recipe:', error);
        router.push('/recipes');
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [recipeId, scale, router]);

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (isEditing && recipe) {
      setEditForm({
        title: recipe.title,
        description: recipe.description || '',
        source_url: recipe.source_url || '',
        source_name: recipe.source_name || '',
        prep_time_minutes: recipe.prep_time_minutes?.toString() || '',
        cook_time_minutes: recipe.cook_time_minutes?.toString() || '',
        difficulty: recipe.difficulty || '',
        yield_quantity: recipe.yield_quantity?.toString() || '',
        yield_unit: recipe.yield_unit || '',
        cover_image_url: recipe.cover_image_url || '',
        notes: recipe.notes || '',
        privacy_level: recipe.privacy_level,
      });
      setEditIngredients(recipe.ingredients.map(ing => ({
        id: ing.id,
        quantity: ing.quantity?.toString() || '',
        unit: ing.unit || '',
        name: ing.name,
        preparation: ing.preparation || '',
        is_optional: ing.is_optional,
      })));
      setEditInstructions(recipe.instructions.map(inst => ({
        id: inst.id,
        step_number: inst.step_number,
        instruction_text: inst.instruction_text,
        duration_minutes: inst.duration_minutes?.toString() || '',
      })));
      setEditTagIds(recipe.tags.map(t => t.id));
      // Load available tags
      tagApi.list().then(setAvailableTags).catch(console.error);
    }
  }, [isEditing, recipe]);

  useEffect(() => {
    if (showCollectionDropdown && collections.length === 0) {
      collectionApi.list().then(setCollections).catch(console.error);
    }
  }, [showCollectionDropdown, collections.length]);

  // Fetch collections this recipe belongs to
  useEffect(() => {
    if (recipe) {
      recipeApi.getCollections(recipeId).then(setRecipeCollections).catch(console.error);
    }
  }, [recipe, recipeId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCollectionDropdown(false);
      }
      if (tagPickerRef.current && !tagPickerRef.current.contains(event.target as Node)) {
        setShowTagPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;
    setDeleting(true);
    try {
      await recipeApi.delete(recipeId);
      router.push('/recipes');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      setDeleting(false);
    }
  };

  const handleClone = async () => {
    setCloning(true);
    try {
      await recipeApi.clone(recipeId);
      setToastMessage('Copied!');
      setTimeout(() => setToastMessage(''), 3000);
      // Refresh recipe data to get the cloned_by_me info
      const updated = await recipeApi.get(recipeId);
      setRecipe(updated);
    } catch (error) {
      console.error('Failed to clone recipe:', error);
      setToastMessage(getErrorMessage(error, 'Failed to save recipe'));
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setCloning(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    setAddingToCollection(collectionId);
    try {
      await collectionApi.addRecipe(collectionId, recipeId);
      const col = collections.find(c => c.id === collectionId);
      setToastMessage(`Added to "${col?.name}"`);
      setTimeout(() => setToastMessage(''), 3000);
      setShowCollectionDropdown(false);
    } catch (error) {
      setToastMessage(getErrorMessage(error, 'Failed to add to collection'));
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setAddingToCollection(null);
    }
  };

  const handleShare = async () => {
    // Use the public share URL for sharing
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/r/${recipeId}`;
    if (navigator.share) {
      try { await navigator.share({ title: recipe?.title, url: shareUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setToastMessage('Link copied!');
      setTimeout(() => setToastMessage(''), 2000);
    }
  };

  const handleSave = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      await recipeApi.update(recipeId, {
        title: editForm.title,
        description: editForm.description || undefined,
        source_url: editForm.source_url || undefined,
        source_name: editForm.source_name || undefined,
        prep_time_minutes: editForm.prep_time_minutes ? parseInt(editForm.prep_time_minutes) : undefined,
        cook_time_minutes: editForm.cook_time_minutes ? parseInt(editForm.cook_time_minutes) : undefined,
        difficulty: editForm.difficulty || undefined,
        yield_quantity: editForm.yield_quantity ? parseFloat(editForm.yield_quantity) : undefined,
        yield_unit: editForm.yield_unit || undefined,
        cover_image_url: editForm.cover_image_url || undefined,
        notes: editForm.notes || undefined,
        privacy_level: editForm.privacy_level,
        ingredients: editIngredients.filter(ing => ing.name.trim()).map((ing, idx) => ({
          sort_order: idx,
          quantity: ing.quantity ? parseFloat(ing.quantity) : undefined,
          unit: ing.unit || undefined,
          name: ing.name,
          preparation: ing.preparation || undefined,
          is_optional: ing.is_optional,
        })),
        instructions: editInstructions.filter(inst => inst.instruction_text.trim()).map((inst, idx) => ({
          step_number: idx + 1,
          instruction_text: inst.instruction_text,
          duration_minutes: inst.duration_minutes ? parseInt(inst.duration_minutes) : undefined,
        })),
        tag_ids: editTagIds,
      });
      // Refresh recipe data
      const updated = await recipeApi.get(recipeId);
      setRecipe(updated);
      setIsEditing(false);
      setToastMessage('Saved!');
      setTimeout(() => setToastMessage(''), 2000);
    } catch (error) {
      console.error('Failed to save:', error);
      setToastMessage('Failed to save');
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const addIngredient = () => {
    setEditIngredients([...editIngredients, {
      id: `new-${Date.now()}`,
      quantity: '',
      unit: '',
      name: '',
      preparation: '',
      is_optional: false,
    }]);
  };

  const removeIngredient = (index: number) => {
    setEditIngredients(editIngredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof EditableIngredient, value: string | boolean) => {
    const updated = [...editIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setEditIngredients(updated);
  };

  const addInstruction = () => {
    setEditInstructions([...editInstructions, {
      id: `new-${Date.now()}`,
      step_number: editInstructions.length + 1,
      instruction_text: '',
      duration_minutes: '',
    }]);
  };

  const removeInstruction = (index: number) => {
    setEditInstructions(editInstructions.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, field: keyof EditableInstruction, value: string | number) => {
    const updated = [...editInstructions];
    updated[index] = { ...updated[index], [field]: value };
    setEditInstructions(updated);
  };

  const toggleTag = (tagId: string) => {
    setEditTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-6 bg-cream-dark rounded w-1/4 mb-4" />
            <div className="h-48 bg-cream-dark rounded-lg mb-4" />
            <div className="h-4 bg-cream-dark rounded w-full mb-2" />
            <div className="h-4 bg-cream-dark rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) return null;

  const isOwner = user?.id === recipe.author_id;
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
  const selectedTags = availableTags.filter(t => editTagIds.includes(t.id));

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 pb-24">
        {/* Breadcrumb & Actions */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/recipes" className="text-warm-gray hover:text-gold text-xs uppercase tracking-wider">
            &larr; Recipes
          </Link>
          {isOwner && !isEditing && (
            <div className="flex gap-3 items-center">
              <button onClick={() => setIsEditing(true)} className="text-xs text-warm-gray hover:text-gold">
                Edit
              </button>
              <button onClick={handleDelete} disabled={deleting} className="text-xs text-warm-gray hover:text-red-500 disabled:opacity-50">
                {deleting ? '...' : 'Delete'}
              </button>
            </div>
          )}
          {isEditing && (
            <span className="text-xs text-gold font-medium">Editing</span>
          )}
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-20 right-4 bg-charcoal text-white px-3 py-1.5 rounded text-sm shadow-lg z-50">
            {toastMessage}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1">
            {/* Cover Image */}
            {isEditing ? (
              <div className="mb-4">
                {editForm.cover_image_url ? (
                  <div className="aspect-[4/3] rounded-lg overflow-hidden relative group">
                    <img src={editForm.cover_image_url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setEditForm({ ...editForm, cover_image_url: '' })}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                    <input
                      type="text"
                      value={editForm.cover_image_url}
                      onChange={e => setEditForm({ ...editForm, cover_image_url: e.target.value })}
                      placeholder="Paste image URL..."
                      className="text-xs text-center bg-transparent w-full px-4 outline-none"
                    />
                  </div>
                )}
              </div>
            ) : recipe.cover_image_url ? (
              <div className="aspect-[4/3] rounded-lg overflow-hidden mb-4">
                <img src={recipe.cover_image_url} alt={recipe.title} className="w-full h-full object-cover" />
              </div>
            ) : null}

            {/* Title */}
            {isEditing ? (
              <input
                type="text"
                value={editForm.title}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                className="font-serif text-2xl text-charcoal mb-1 w-full bg-transparent border-b border-border focus:border-gold outline-none"
                placeholder="Recipe title"
              />
            ) : (
              <h1 className="font-serif text-2xl text-charcoal mb-1">{recipe.title}</h1>
            )}

            {/* Author (show when viewing someone else's recipe) */}
            {!isOwner && recipe.author && (
              <Link
                href={`/profile/${recipe.author.username || recipe.author.id}`}
                className="flex items-center gap-2 mb-3 group"
              >
                <div className="w-6 h-6 rounded-full bg-cream-dark flex items-center justify-center overflow-hidden">
                  {recipe.author.profile_image_url ? (
                    <img
                      src={recipe.author.profile_image_url}
                      alt={recipe.author.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-serif text-charcoal">
                      {recipe.author.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm text-warm-gray group-hover:text-gold transition-colors">
                  {recipe.author.name}
                </span>
              </Link>
            )}

            {/* Cloned from attribution */}
            {recipe.forked_from?.user_name && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-warm-gray">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span>Saved from </span>
                <Link
                  href={`/profile/${recipe.forked_from.user_username || recipe.forked_from.user_id}`}
                  className="text-gold hover:text-gold-dark transition-colors"
                >
                  {recipe.forked_from.user_username ? `@${recipe.forked_from.user_username}` : recipe.forked_from.user_name}
                </Link>
              </div>
            )}

            {/* Source */}
            {isEditing ? (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={editForm.source_name}
                  onChange={e => setEditForm({ ...editForm, source_name: e.target.value })}
                  placeholder="Source name"
                  className="text-xs text-warm-gray bg-transparent border-b border-border focus:border-gold outline-none flex-1"
                />
                <input
                  type="text"
                  value={editForm.source_url}
                  onChange={e => setEditForm({ ...editForm, source_url: e.target.value })}
                  placeholder="URL"
                  className="text-xs text-warm-gray bg-transparent border-b border-border focus:border-gold outline-none flex-1"
                />
              </div>
            ) : (recipe.source_url || recipe.source_name) && (
              <p className="text-xs text-warm-gray mb-3">
                {recipe.source_url ? (
                  <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                    {recipe.source_name || recipe.source_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </a>
                ) : recipe.source_name}
              </p>
            )}

            {/* Description */}
            {isEditing ? (
              <textarea
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Description..."
                rows={3}
                className="text-warm-gray text-sm mb-3 leading-relaxed w-full bg-transparent border border-border rounded p-2 focus:border-gold outline-none resize-none"
              />
            ) : recipe.description && (
              <p className="text-warm-gray text-sm mb-3 leading-relaxed">{recipe.description}</p>
            )}

            {/* Tags */}
            {isEditing ? (
              <div className="relative mb-3" ref={tagPickerRef}>
                <div
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="flex flex-wrap gap-1.5 min-h-[28px] cursor-pointer border border-border rounded p-1.5"
                >
                  {selectedTags.length > 0 ? selectedTags.map(tag => (
                    <span key={tag.id} className="bg-gold/15 text-gold-dark px-2 py-0.5 rounded text-xs flex items-center gap-1">
                      {tag.name}
                      <button onClick={(e) => { e.stopPropagation(); toggleTag(tag.id); }} className="hover:text-red-500">×</button>
                    </span>
                  )) : (
                    <span className="text-xs text-warm-gray">Click to add tags...</span>
                  )}
                </div>
                {showTagPicker && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-cream transition-colors ${editTagIds.includes(tag.id) ? 'bg-gold/10 text-gold-dark' : 'text-charcoal'}`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {recipe.tags.map(tag => (
                  <span key={tag.id} className="bg-gold/15 text-gold-dark px-2 py-0.5 rounded text-xs">{tag.name}</span>
                ))}
              </div>
            )}

            {/* Collections this recipe belongs to */}
            {!isEditing && recipeCollections.length > 0 && (
              <div className="mb-3">
                <span className="text-xs text-warm-gray block mb-1.5">In collections:</span>
                <div className="flex flex-wrap gap-1.5">
                  {recipeCollections.map(collection => (
                    <Link
                      key={collection.id}
                      href={`/recipes?collection=${collection.id}`}
                      className="bg-cream hover:bg-cream-dark text-charcoal px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      {collection.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Meta Row */}
            {isEditing ? (
              <div className="flex flex-wrap gap-2 text-xs mb-4">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editForm.prep_time_minutes}
                    onChange={e => setEditForm({ ...editForm, prep_time_minutes: e.target.value })}
                    placeholder="Prep"
                    className="w-12 bg-transparent border-b border-border focus:border-gold outline-none text-center"
                  />
                  <span className="text-warm-gray">min prep</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editForm.cook_time_minutes}
                    onChange={e => setEditForm({ ...editForm, cook_time_minutes: e.target.value })}
                    placeholder="Cook"
                    className="w-12 bg-transparent border-b border-border focus:border-gold outline-none text-center"
                  />
                  <span className="text-warm-gray">min cook</span>
                </div>
                <select
                  value={editForm.difficulty}
                  onChange={e => setEditForm({ ...editForm, difficulty: e.target.value as any })}
                  className="bg-transparent border-b border-border focus:border-gold outline-none text-xs"
                >
                  <option value="">Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, privacy_level: editForm.privacy_level === 'private' ? 'public' : 'private' })}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-colors ${
                    editForm.privacy_level === 'private'
                      ? 'border-warm-gray text-warm-gray'
                      : 'border-green-500 text-green-600'
                  }`}
                >
                  {editForm.privacy_level === 'private' ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Private
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Public
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs text-warm-gray mb-4">
                {totalTime > 0 && <span>{totalTime} min</span>}
                {totalTime > 0 && recipe.difficulty && <span>·</span>}
                {recipe.difficulty && (
                  <span className={`capitalize ${recipe.difficulty === 'easy' ? 'text-green-600' : recipe.difficulty === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                    {recipe.difficulty}
                  </span>
                )}
                {(totalTime > 0 || recipe.difficulty) && <span>·</span>}
                <span className={`flex items-center gap-1 ${recipe.privacy_level === 'private' ? 'text-warm-gray' : 'text-green-600'}`}>
                  {recipe.privacy_level === 'private' ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Private
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Public
                    </>
                  )}
                </span>
                <span>·</span>
                <span title={`Created ${new Date(recipe.created_at).toLocaleDateString()}`}>
                  Updated {new Date(recipe.updated_at).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Action buttons */}
            {!isEditing && (
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                {/* Save to My Recipes (for other users' recipes) */}
                {!isOwner && user && (
                  recipe.cloned_by_me ? (
                    <Link
                      href={`/recipes/${recipe.cloned_by_me.cloned_recipe_id}`}
                      className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                      Copied {new Date(recipe.cloned_by_me.cloned_at).toLocaleDateString()}
                    </Link>
                  ) : (
                    <button
                      onClick={handleClone}
                      disabled={cloning}
                      className="flex items-center gap-1.5 text-xs bg-gold hover:bg-gold-dark text-white px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                    >
                      {cloning ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          Save to My Recipes
                        </>
                      )}
                    </button>
                  )
                )}

                {/* Add to Collection (for own recipes) */}
                {isOwner && (
                  <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setShowCollectionDropdown(!showCollectionDropdown)} className="flex items-center gap-1.5 text-xs text-warm-gray hover:text-gold transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Collection
                    </button>
                    {showCollectionDropdown && (
                      <div className="absolute left-0 bottom-full mb-2 w-48 bg-white border border-border rounded-lg shadow-lg z-50">
                        <div className="p-1.5">
                          {collections.length === 0 ? (
                            <div className="p-2 text-center">
                              <p className="text-warm-gray text-xs mb-1">No collections</p>
                              <Link href="/collections" className="text-gold hover:text-gold-dark text-xs">Create one</Link>
                            </div>
                          ) : collections.map(collection => (
                            <button key={collection.id} onClick={() => handleAddToCollection(collection.id)} disabled={addingToCollection === collection.id} className="w-full px-2.5 py-1.5 text-left text-xs text-charcoal hover:bg-cream rounded transition-colors flex items-center justify-between disabled:opacity-50">
                              <span>{collection.name}</span>
                              {addingToCollection === collection.id && <div className="animate-spin rounded-full h-3 w-3 border border-gold border-t-transparent" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={handleShare} className="flex items-center gap-1.5 text-xs text-warm-gray hover:text-gold transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ingredients */}
            <div className="bg-white rounded-lg border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl text-charcoal">Ingredients</h2>
                {isEditing ? (
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="number"
                      value={editForm.yield_quantity}
                      onChange={e => setEditForm({ ...editForm, yield_quantity: e.target.value })}
                      placeholder="Qty"
                      className="w-12 bg-transparent border-b border-border focus:border-gold outline-none text-center"
                    />
                    <input
                      type="text"
                      value={editForm.yield_unit}
                      onChange={e => setEditForm({ ...editForm, yield_unit: e.target.value })}
                      placeholder="servings"
                      className="w-16 bg-transparent border-b border-border focus:border-gold outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-warm-gray">{recipe.scaled_yield_quantity} {recipe.yield_unit}</span>
                    <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
                      <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="w-5 h-5 rounded bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal text-xs transition-colors">−</button>
                      <span className="w-6 text-center text-xs text-charcoal">{scale}x</span>
                      <button onClick={() => setScale(s => s + 0.5)} className="w-5 h-5 rounded bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal text-xs transition-colors">+</button>
                      {scale !== 1 && <button onClick={() => setScale(1)} className="text-xs text-warm-gray hover:text-gold ml-1">reset</button>}
                    </div>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  {editIngredients.map((ing, idx) => (
                    <div key={ing.id} className="flex items-center gap-2 group">
                      <input
                        type="text"
                        value={ing.quantity}
                        onChange={e => updateIngredient(idx, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className="w-14 text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none"
                      />
                      <input
                        type="text"
                        value={ing.unit}
                        onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                        placeholder="unit"
                        className="w-16 text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none"
                      />
                      <input
                        type="text"
                        value={ing.name}
                        onChange={e => updateIngredient(idx, 'name', e.target.value)}
                        placeholder="Ingredient name"
                        className="flex-1 text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none"
                      />
                      <input
                        type="text"
                        value={ing.preparation}
                        onChange={e => updateIngredient(idx, 'preparation', e.target.value)}
                        placeholder="prep"
                        className="w-20 text-xs bg-cream rounded px-2 py-1.5 focus:ring-1 focus:ring-gold outline-none"
                      />
                      <button onClick={() => removeIngredient(idx)} className="text-warm-gray hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={addIngredient} className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 mt-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Add ingredient
                  </button>
                </div>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 pl-4">
                  {recipe.ingredients.map(ing => (
                    <li key={ing.id} className="text-xs text-charcoal leading-relaxed list-disc marker:text-gold">
                      {formatIngredient(ing)}
                      {ing.is_optional && <span className="text-warm-gray"> (optional)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-lg border border-border p-5">
              <h2 className="font-serif text-xl text-charcoal mb-4">Instructions</h2>

              {isEditing ? (
                <div className="space-y-3">
                  {editInstructions.map((inst, idx) => (
                    <div key={inst.id} className="flex gap-3 group">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold text-white text-xs font-medium flex items-center justify-center mt-1">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <textarea
                          value={inst.instruction_text}
                          onChange={e => updateInstruction(idx, 'instruction_text', e.target.value)}
                          placeholder="Instruction step..."
                          rows={2}
                          className="w-full text-sm bg-cream rounded px-3 py-2 focus:ring-1 focus:ring-gold outline-none resize-none"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="number"
                            value={inst.duration_minutes}
                            onChange={e => updateInstruction(idx, 'duration_minutes', e.target.value)}
                            placeholder="Time"
                            className="w-14 text-xs bg-cream rounded px-2 py-1 focus:ring-1 focus:ring-gold outline-none"
                          />
                          <span className="text-xs text-warm-gray">min</span>
                        </div>
                      </div>
                      <button onClick={() => removeInstruction(idx)} className="text-warm-gray hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={addInstruction} className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 mt-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Add step
                  </button>
                </div>
              ) : (
                <ol className="space-y-4">
                  {recipe.instructions.map(inst => (
                    <li key={inst.id} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold text-white text-xs font-medium flex items-center justify-center">{inst.step_number}</span>
                      <div className="pt-0.5">
                        <p className="text-charcoal text-sm leading-relaxed">{inst.instruction_text}</p>
                        {inst.duration_minutes && <span className="text-xs text-warm-gray mt-0.5 block">{inst.duration_minutes} min</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Notes */}
            {(isEditing || recipe.notes) && (
              <div className="bg-white rounded-lg border border-border p-5">
                <h2 className="font-serif text-xl text-charcoal mb-4">Notes</h2>

                {isEditing ? (
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Add any additional notes, tips, or variations..."
                    rows={4}
                    className="w-full text-sm bg-cream rounded px-3 py-2 focus:ring-1 focus:ring-gold outline-none resize-none"
                  />
                ) : (
                  <p className="text-charcoal text-sm leading-relaxed whitespace-pre-wrap">{recipe.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Save/Cancel Bar */}
      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-lg z-50">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
            <button onClick={handleCancel} className="text-sm text-warm-gray hover:text-charcoal transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editForm.title.trim()}
              className="bg-gold hover:bg-gold-dark text-white text-sm font-medium px-6 py-2 rounded-full transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
