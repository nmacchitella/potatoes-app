'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collectionApi, recipeApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import type { Collection, RecipeSummary } from '@/types';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  // Add recipes modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [availableRecipes, setAvailableRecipes] = useState<RecipeSummary[]>([]);
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<Set<string>>(new Set());
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const data = await collectionApi.list();
      setCollections(data);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollection.name.trim()) return;

    setCreating(true);
    try {
      const created = await collectionApi.create({
        name: newCollection.name,
        description: newCollection.description || undefined,
      });
      setCollections([...collections, created]);
      setNewCollection({ name: '', description: '' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      await collectionApi.delete(id);
      setCollections(collections.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  const openAddRecipesModal = async (collection: Collection) => {
    setSelectedCollection(collection);
    setShowAddModal(true);
    setLoadingRecipes(true);
    try {
      // Load collection details to get current recipes
      const collectionDetails = await collectionApi.get(collection.id);
      const currentRecipeIds = new Set(collectionDetails.recipes.map((r: any) => r.id));
      setCollectionRecipeIds(currentRecipeIds);

      // Load all user's recipes
      const response = await recipeApi.list({ page_size: 100 });
      // Filter out recipes already in the collection
      setAvailableRecipes(response.items.filter(r => !currentRecipeIds.has(r.id)));
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleAddRecipe = async (recipeId: string) => {
    if (!selectedCollection) return;
    try {
      await collectionApi.addRecipe(selectedCollection.id, recipeId);
      // Update available recipes
      setAvailableRecipes(prev => prev.filter(r => r.id !== recipeId));
      setCollectionRecipeIds(prev => new Set([...prev, recipeId]));
      // Update collection recipe count
      setCollections(prev =>
        prev.map(c =>
          c.id === selectedCollection.id
            ? { ...c, recipe_count: (c.recipe_count || 0) + 1 }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to add recipe:', error);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-serif text-4xl text-charcoal">Collections</h1>
            <p className="text-warm-gray mt-2">Organize your recipes into collections</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            New Collection
          </button>
        </div>

        {/* Collections Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
              <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="font-serif text-xl text-charcoal mb-2">No collections yet</h3>
            <p className="text-warm-gray mb-6">Create your first collection to organize your recipes</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Create Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map(collection => (
              <div
                key={collection.id}
                className="card group hover:shadow-md transition-shadow"
              >
                <Link href={`/collections/${collection.id}`} className="block">
                  {/* Cover Image or Placeholder */}
                  <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-4 overflow-hidden">
                    {collection.cover_image_url ? (
                      <img
                        src={collection.cover_image_url}
                        alt={collection.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-serif text-xl text-charcoal group-hover:text-gold transition-colors">
                        {collection.name}
                      </h3>
                      {collection.description && (
                        <p className="text-warm-gray text-sm mt-1 line-clamp-2">
                          {collection.description}
                        </p>
                      )}
                      <p className="text-warm-gray-light text-sm mt-2">
                        {collection.recipe_count || 0} recipes
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {collection.is_default && (
                        <span className="text-xs text-gold border border-gold/30 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                      {collection.privacy_level === 'public' && (
                        <svg className="w-4 h-4 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Action buttons */}
                <div className="mt-4 pt-3 border-t border-cream-dark flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      openAddRecipesModal(collection);
                    }}
                    className="flex items-center gap-1.5 text-sm text-gold hover:text-gold-dark transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Recipes
                  </button>
                  <Link
                    href={`/collections/${collection.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-warm-gray hover:text-charcoal transition-colors"
                  >
                    Manage
                  </Link>
                  {!collection.is_default && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteCollection(collection.id);
                      }}
                      className="text-sm text-warm-gray hover:text-red-500 transition-colors ml-auto"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="font-serif text-2xl text-charcoal mb-6">New Collection</h2>

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="label mb-2 block">Name *</label>
                <input
                  type="text"
                  value={newCollection.name}
                  onChange={e => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="e.g., Weeknight Dinners"
                  className="input-field w-full"
                  autoFocus
                />
              </div>

              <div>
                <label className="label mb-2 block">Description</label>
                <textarea
                  value={newCollection.description}
                  onChange={e => setNewCollection({ ...newCollection, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className="input-field w-full"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newCollection.name.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Recipes Modal */}
      {showAddModal && selectedCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-2xl text-charcoal">Add Recipes</h2>
                <p className="text-sm text-warm-gray mt-1">to {selectedCollection.name}</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-warm-gray hover:text-charcoal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingRecipes ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
                </div>
              ) : availableRecipes.length === 0 ? (
                <p className="text-center py-12 text-warm-gray">
                  {collectionRecipeIds.size === 0
                    ? "You don't have any recipes yet"
                    : 'All your recipes are already in this collection'}
                </p>
              ) : (
                <div className="space-y-3">
                  {availableRecipes.map(recipe => (
                    <div
                      key={recipe.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-cream transition-colors"
                    >
                      <div className="w-16 h-16 rounded-lg bg-cream-dark flex-shrink-0 overflow-hidden">
                        {recipe.cover_image_url ? (
                          <img
                            src={recipe.cover_image_url}
                            alt={recipe.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-charcoal truncate">{recipe.title}</h4>
                        {recipe.description && (
                          <p className="text-sm text-warm-gray truncate">{recipe.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAddRecipe(recipe.id)}
                        className="btn-secondary text-sm py-1.5"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
