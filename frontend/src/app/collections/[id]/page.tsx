'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { collectionApi, recipeApi, socialApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { CollectionWithRecipes, RecipeSummary, CollectionShare, UserSearchResult } from '@/types';

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;
  const { user } = useStore();

  const [collection, setCollection] = useState<CollectionWithRecipes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Permissions - determined after loading
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Add recipes modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableRecipes, setAvailableRecipes] = useState<RecipeSummary[]>([]);
  const [totalRecipeCount, setTotalRecipeCount] = useState(0);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shares, setShares] = useState<CollectionShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [newSharePermission, setNewSharePermission] = useState<'viewer' | 'editor'>('viewer');

  useEffect(() => {
    loadCollection();
  }, [collectionId]);

  const loadCollection = async () => {
    try {
      const data = await collectionApi.get(collectionId);
      setCollection(data);
      setEditForm({ name: data.name, description: data.description || '' });

      // Determine permissions
      const ownerCheck = user?.id === data.user_id;
      setIsOwner(ownerCheck);
      // For now, assume if we can load it and we're not owner, check if we have edit permission
      // The backend will enforce this, but for UI we assume editor if not owner but can access
      setCanEdit(ownerCheck); // Will be updated when we load shares
    } catch (error) {
      setError('Collection not found');
    } finally {
      setLoading(false);
    }
  };

  // Load shares when share modal opens
  const loadShares = async () => {
    setLoadingShares(true);
    try {
      const data = await collectionApi.listShares(collectionId);
      setShares(data);

      // Check if current user is an editor (if not owner)
      if (!isOwner && user) {
        const myShare = data.find(s => s.user_id === user.id);
        setCanEdit(myShare?.permission === 'editor');
      }
    } catch (error) {
      console.error('Failed to load shares:', error);
    } finally {
      setLoadingShares(false);
    }
  };

  // Search users for sharing
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const results = await socialApi.searchUsers(query, 10);
      // Filter out the owner and users already shared with
      const sharedUserIds = new Set(shares.map(s => s.user_id));
      const filtered = results.filter(u =>
        u.id !== collection?.user_id && !sharedUserIds.has(u.id)
      );
      setUserSearchResults(filtered);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Share with a user
  const handleShare = async (userId: string) => {
    try {
      const newShare = await collectionApi.share(collectionId, {
        user_id: userId,
        permission: newSharePermission
      });
      setShares([...shares, newShare]);
      setUserSearchResults(userSearchResults.filter(u => u.id !== userId));
      setUserSearchQuery('');
    } catch (error) {
      console.error('Failed to share collection:', error);
    }
  };

  // Update a share's permission
  const handleUpdateShare = async (userId: string, permission: 'viewer' | 'editor') => {
    try {
      const updated = await collectionApi.updateShare(collectionId, userId, { permission });
      setShares(shares.map(s => s.user_id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update share:', error);
    }
  };

  // Remove a share
  const handleRemoveShare = async (userId: string) => {
    try {
      await collectionApi.removeShare(collectionId, userId);
      setShares(shares.filter(s => s.user_id !== userId));
    } catch (error) {
      console.error('Failed to remove share:', error);
    }
  };

  // Open share modal
  const openShareModal = () => {
    setShowShareModal(true);
    loadShares();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;

    setSaving(true);
    try {
      const updated = await collectionApi.update(collectionId, {
        name: editForm.name,
        description: editForm.description || undefined,
      });
      setCollection(prev => prev ? { ...prev, ...updated } : null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Failed to update collection:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this collection? Recipes will not be deleted.')) return;

    try {
      await collectionApi.delete(collectionId);
      router.push('/collections');
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  const openAddRecipesModal = async () => {
    setShowAddModal(true);
    setLoadingRecipes(true);
    try {
      const response = await recipeApi.list({ page: 1, page_size: 100 });
      setTotalRecipeCount(response.items.length);
      // Filter out recipes already in the collection
      const collectionRecipeIds = new Set(collection?.recipes.map(r => r.id) || []);
      setAvailableRecipes(response.items.filter(r => !collectionRecipeIds.has(r.id)));
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleAddRecipe = async (recipeId: string) => {
    try {
      await collectionApi.addRecipe(collectionId, recipeId);
      // Refresh collection
      await loadCollection();
      // Update available recipes
      setAvailableRecipes(prev => prev.filter(r => r.id !== recipeId));
    } catch (error) {
      console.error('Failed to add recipe:', error);
    }
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    if (!confirm('Remove this recipe from the collection?')) return;

    try {
      await collectionApi.removeRecipe(collectionId, recipeId);
      setCollection(prev =>
        prev ? { ...prev, recipes: prev.recipes.filter(r => r.id !== recipeId) } : null
      );
    } catch (error) {
      console.error('Failed to remove recipe:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <div className="text-center py-16">
            <h2 className="font-serif text-2xl text-charcoal mb-4">Collection not found</h2>
            <Link href="/collections" className="text-gold hover:text-gold-dark">
              &larr; Back to Collections
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/collections" className="text-warm-gray hover:text-gold text-sm uppercase tracking-wider mb-4 inline-block">
            &larr; All Collections
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-4xl text-charcoal">{collection.name}</h1>
              {collection.description && (
                <p className="text-warm-gray mt-2 max-w-2xl">{collection.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-warm-gray">
                <span>{collection.recipes.length} recipes</span>
                {collection.privacy_level === 'public' && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Public
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {(isOwner || canEdit) && (
                <button
                  onClick={openAddRecipesModal}
                  className="btn-primary"
                >
                  Add Recipes
                </button>
              )}
              {(isOwner || canEdit) && (
                <button
                  onClick={openShareModal}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              )}
              {!collection.is_default && isOwner && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn-secondary"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recipes Grid */}
        {collection.recipes.length === 0 ? (
          <div className="text-center py-16 card">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
              <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="font-serif text-xl text-charcoal mb-2">No recipes yet</h3>
            <p className="text-warm-gray mb-6">Add recipes to this collection to get started</p>
            <button onClick={openAddRecipesModal} className="btn-primary">
              Add Recipes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collection.recipes.map(recipe => (
              <div key={recipe.id} className="card group">
                <Link href={`/recipes/${recipe.id}`} className="block">
                  {recipe.cover_image_url ? (
                    <div className="aspect-[4/3] rounded-lg overflow-hidden mb-4">
                      <img
                        src={recipe.cover_image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-lg bg-cream-dark mb-4 flex items-center justify-center">
                      <svg className="w-12 h-12 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  <h3 className="font-serif text-lg text-charcoal group-hover:text-gold transition-colors">
                    {recipe.title}
                  </h3>

                  {recipe.description && (
                    <p className="text-warm-gray text-sm mt-1 line-clamp-2">{recipe.description}</p>
                  )}

                  <div className="flex gap-3 mt-2 text-sm text-warm-gray-light">
                    {recipe.prep_time_minutes && <span>{recipe.prep_time_minutes}m prep</span>}
                    {recipe.cook_time_minutes && <span>{recipe.cook_time_minutes}m cook</span>}
                  </div>
                </Link>

                {(isOwner || canEdit) && (
                  <button
                    onClick={() => handleRemoveRecipe(recipe.id)}
                    className="mt-3 text-sm text-warm-gray hover:text-red-500 transition-colors"
                  >
                    Remove from collection
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="font-serif text-2xl text-charcoal mb-6">Edit Collection</h2>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label mb-2 block">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="label mb-2 block">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="input-field w-full"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editForm.name.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleDelete}
                className="w-full text-sm text-red-500 hover:text-red-600 mt-4"
              >
                Delete Collection
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Recipes Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-charcoal">Add Recipes</h2>
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
              ) : totalRecipeCount === 0 ? (
                <div className="text-center py-12">
                  <p className="text-warm-gray mb-4">You don't have any recipes yet</p>
                  <Link href="/recipes/new" className="btn-primary">
                    Create Your First Recipe
                  </Link>
                </div>
              ) : availableRecipes.length === 0 ? (
                <p className="text-center py-12 text-warm-gray">
                  All your recipes are already in this collection
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-charcoal">Share Collection</h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-warm-gray hover:text-charcoal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Add people section */}
            <div className="mb-6">
              <label className="label mb-2 block">Add people</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    placeholder="Search by name or username..."
                    className="input-field w-full"
                  />
                  {/* Search results dropdown */}
                  {userSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-cream-dark rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                      {userSearchResults.map(searchUser => (
                        <button
                          key={searchUser.id}
                          onClick={() => handleShare(searchUser.id)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-cream transition-colors text-left"
                        >
                          {searchUser.profile_image_url ? (
                            <img
                              src={searchUser.profile_image_url}
                              alt={searchUser.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center">
                              <span className="text-sm text-warm-gray">
                                {searchUser.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-charcoal truncate">{searchUser.name}</p>
                            {searchUser.username && (
                              <p className="text-xs text-warm-gray truncate">@{searchUser.username}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchingUsers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border border-gold border-t-transparent" />
                    </div>
                  )}
                </div>
                <select
                  value={newSharePermission}
                  onChange={(e) => setNewSharePermission(e.target.value as 'viewer' | 'editor')}
                  className="input-field w-28"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <p className="text-xs text-warm-gray mt-2">
                Viewers can only see the collection. Editors can add/remove recipes and share with others.
              </p>
            </div>

            {/* Current shares list */}
            <div className="flex-1 overflow-y-auto">
              <label className="label mb-2 block">People with access</label>
              {loadingShares ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gold border-t-transparent" />
                </div>
              ) : shares.length === 0 ? (
                <p className="text-warm-gray text-sm py-4 text-center">
                  This collection isn't shared with anyone yet
                </p>
              ) : (
                <div className="space-y-2">
                  {shares.map(share => (
                    <div
                      key={share.id}
                      className="flex items-center gap-3 p-3 bg-cream/50 rounded-lg"
                    >
                      {share.user.profile_image_url ? (
                        <img
                          src={share.user.profile_image_url}
                          alt={share.user.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-cream-dark flex items-center justify-center">
                          <span className="text-sm text-warm-gray">
                            {share.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-charcoal truncate">{share.user.name}</p>
                        {share.user.username && (
                          <p className="text-xs text-warm-gray truncate">@{share.user.username}</p>
                        )}
                      </div>
                      <select
                        value={share.permission}
                        onChange={(e) => handleUpdateShare(share.user_id, e.target.value as 'viewer' | 'editor')}
                        className="input-field text-sm py-1 w-24"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={() => handleRemoveShare(share.user_id)}
                        className="text-warm-gray hover:text-red-500 transition-colors p-1"
                        title="Remove access"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-cream-dark">
              <button
                onClick={() => setShowShareModal(false)}
                className="btn-primary w-full"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
