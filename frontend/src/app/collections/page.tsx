'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collectionApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import RecipeSearchModal from '@/components/search/RecipeSearchModal';
import type { Collection, RecipeSummary, SharedCollection } from '@/types';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sharedCollections, setSharedCollections] = useState<SharedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');

  // Add recipes modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const [myCollections, shared] = await Promise.all([
        collectionApi.list(),
        collectionApi.listSharedWithMe()
      ]);
      setCollections(myCollections);
      setSharedCollections(shared);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to leave this shared collection?')) return;

    try {
      await collectionApi.leave(collectionId);
      setSharedCollections(sharedCollections.filter(c => c.id !== collectionId));
    } catch (error) {
      console.error('Failed to leave collection:', error);
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
    try {
      // Load collection details to get current recipes
      const collectionDetails = await collectionApi.get(collection.id);
      const currentRecipeIds = new Set(collectionDetails.recipes.map((r: any) => r.id));
      setCollectionRecipeIds(currentRecipeIds);
    } catch (error) {
      console.error('Failed to load collection recipes:', error);
    }
  };

  const handleAddRecipe = async (recipe: RecipeSummary) => {
    if (!selectedCollection) return;
    try {
      await collectionApi.addRecipe(selectedCollection.id, recipe.id);
      setCollectionRecipeIds(prev => new Set([...prev, recipe.id]));
      // Update collection recipe count
      setCollections(prev =>
        prev.map(c =>
          c.id === selectedCollection.id
            ? { ...c, recipe_count: (c.recipe_count || 0) + 1 }
            : c
        )
      );
    } catch (error: any) {
      console.error('Failed to add recipe:', error);
      throw error; // Re-throw so the modal knows it failed
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
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

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-cream-dark">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'my'
                ? 'text-gold border-gold'
                : 'text-warm-gray border-transparent hover:text-charcoal'
            }`}
          >
            My Collections ({collections.length})
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'shared'
                ? 'text-gold border-gold'
                : 'text-warm-gray border-transparent hover:text-charcoal'
            }`}
          >
            Shared with me ({sharedCollections.length})
          </button>
        </div>

        {/* Collections Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        ) : activeTab === 'my' ? (
          // My Collections Tab
          collections.length === 0 ? (
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
          )
        ) : (
          // Shared with me Tab
          sharedCollections.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
                <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-serif text-xl text-charcoal mb-2">No shared collections</h3>
              <p className="text-warm-gray">Collections shared with you will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedCollections.map(collection => (
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

                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          collection.permission === 'editor'
                            ? 'bg-gold/10 text-gold'
                            : 'bg-warm-gray/10 text-warm-gray'
                        }`}>
                          {collection.permission === 'editor' ? 'Can edit' : 'View only'}
                        </span>
                      </div>
                    </div>

                    {/* Owner info */}
                    <div className="mt-3 flex items-center gap-2 text-sm text-warm-gray">
                      {collection.owner.profile_image_url ? (
                        <img
                          src={collection.owner.profile_image_url}
                          alt={collection.owner.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-cream-dark flex items-center justify-center">
                          <span className="text-xs text-warm-gray">
                            {collection.owner.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span>by {collection.owner.name}</span>
                    </div>
                  </Link>

                  {/* Action buttons */}
                  <div className="mt-4 pt-3 border-t border-cream-dark flex items-center gap-3">
                    <Link
                      href={`/collections/${collection.id}`}
                      className="text-sm text-gold hover:text-gold-dark transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleLeaveCollection(collection.id);
                      }}
                      className="text-sm text-warm-gray hover:text-red-500 transition-colors ml-auto"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
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
      <RecipeSearchModal
        isOpen={showAddModal && !!selectedCollection}
        onClose={() => {
          setShowAddModal(false);
          setSelectedCollection(null);
        }}
        onSelectRecipe={handleAddRecipe}
        excludeRecipeIds={collectionRecipeIds}
        title={`Add to ${selectedCollection?.name || 'Collection'}`}
      />
    </div>
  );
}
