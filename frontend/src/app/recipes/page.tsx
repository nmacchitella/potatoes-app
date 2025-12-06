'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi, collectionApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import type { RecipeSummary, Collection, Tag } from '@/types';

export default function RecipesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Recipe state
  const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [initialCollectionLoaded, setInitialCollectionLoaded] = useState(false);

  // Inline collection management
  const [isManageMode, setIsManageMode] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  // Recipe management panel
  const [managingCollectionId, setManagingCollectionId] = useState<string | null>(null);
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<Set<string>>(new Set());
  const [savingRecipes, setSavingRecipes] = useState<string | null>(null);

  // Local filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'all' | 'any'>('all'); // 'all' = AND, 'any' = OR

  const newCollectionInputRef = useRef<HTMLInputElement>(null);
  const editCollectionInputRef = useRef<HTMLInputElement>(null);

  // Load collections on mount
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
      setLoadingCollections(false);
    }
  };

  // Read collection from URL query parameter
  useEffect(() => {
    if (!loadingCollections && !initialCollectionLoaded) {
      const collectionParam = searchParams.get('collection');
      if (collectionParam && collections.some(c => c.id === collectionParam)) {
        setSelectedCollection(collectionParam);
      }
      setInitialCollectionLoaded(true);
    }
  }, [searchParams, collections, loadingCollections, initialCollectionLoaded]);

  // Update URL when collection changes (after initial load)
  useEffect(() => {
    if (initialCollectionLoaded) {
      const currentParam = searchParams.get('collection');
      if (selectedCollection !== currentParam) {
        const url = selectedCollection
          ? `/recipes?collection=${selectedCollection}`
          : '/recipes';
        router.replace(url, { scroll: false });
      }
    }
  }, [selectedCollection, initialCollectionLoaded, router, searchParams]);

  // Load recipes when collection changes
  useEffect(() => {
    fetchRecipes();
  }, [currentPage, selectedCollection]);

  // Clear filters when changing collection
  useEffect(() => {
    setSearchQuery('');
    setSelectedTags([]);
  }, [selectedCollection]);

  // Focus input when creating new collection
  useEffect(() => {
    if (isCreatingCollection && newCollectionInputRef.current) {
      newCollectionInputRef.current.focus();
    }
  }, [isCreatingCollection]);

  // Focus input when editing collection
  useEffect(() => {
    if (editingCollectionId && editCollectionInputRef.current) {
      editCollectionInputRef.current.focus();
    }
  }, [editingCollectionId]);

  // Load collection recipes when managing
  useEffect(() => {
    if (managingCollectionId) {
      loadCollectionRecipes(managingCollectionId);
    }
  }, [managingCollectionId]);

  const loadCollectionRecipes = async (collectionId: string) => {
    try {
      const collection = await collectionApi.get(collectionId);
      setCollectionRecipeIds(new Set(collection.recipes.map(r => r.id)));
    } catch (error) {
      console.error('Failed to load collection recipes:', error);
    }
  };

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      if (selectedCollection) {
        const collection = await collectionApi.get(selectedCollection);
        setAllRecipes(collection.recipes);
        setTotalPages(1);
      } else {
        const response = await recipeApi.list({
          page: currentPage,
          page_size: 100,
        });
        setAllRecipes(response.items);
        setTotalPages(response.total_pages);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique tags from current recipes
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    allRecipes.forEach(recipe => {
      recipe.tags?.forEach(tag => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag);
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRecipes]);

  // Filter recipes locally
  const filteredRecipes = useMemo(() => {
    let result = allRecipes;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(recipe =>
        recipe.title.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query)
      );
    }

    if (selectedTags.length > 0) {
      if (tagFilterMode === 'all') {
        // AND: recipe must have ALL selected tags
        result = result.filter(recipe =>
          selectedTags.every(tagId =>
            recipe.tags?.some(tag => tag.id === tagId)
          )
        );
      } else {
        // OR: recipe must have ANY of the selected tags
        result = result.filter(recipe =>
          selectedTags.some(tagId =>
            recipe.tags?.some(tag => tag.id === tagId)
          )
        );
      }
    }

    return result;
  }, [allRecipes, searchQuery, selectedTags, tagFilterMode]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCollectionClick = (collectionId: string | null) => {
    if (isManageMode) return;
    setSelectedCollection(collectionId);
    setCurrentPage(1);
  };

  // Collection CRUD handlers
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setSavingCollection(true);
    try {
      const newCollection = await collectionApi.create({ name: newCollectionName.trim() });
      setCollections(prev => [...prev, newCollection]);
      setNewCollectionName('');
      setIsCreatingCollection(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
    } finally {
      setSavingCollection(false);
    }
  };

  const handleUpdateCollection = async (collectionId: string) => {
    if (!editingCollectionName.trim()) return;
    setSavingCollection(true);
    try {
      const updated = await collectionApi.update(collectionId, { name: editingCollectionName.trim() });
      setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, name: updated.name } : c));
      setEditingCollectionId(null);
      setEditingCollectionName('');
    } catch (error) {
      console.error('Failed to update collection:', error);
    } finally {
      setSavingCollection(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Delete this collection? Recipes will not be deleted.')) return;
    try {
      await collectionApi.delete(collectionId);
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete collection');
    }
  };

  const startEditingCollection = (collection: Collection) => {
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  };

  const toggleCollectionPrivacy = async (collection: Collection) => {
    try {
      const newPrivacy = collection.privacy_level === 'public' ? 'private' : 'public';
      await collectionApi.update(collection.id, { privacy_level: newPrivacy });
      setCollections(prev => prev.map(c =>
        c.id === collection.id ? { ...c, privacy_level: newPrivacy } : c
      ));
    } catch (error) {
      console.error('Failed to update collection privacy:', error);
    }
  };

  // Recipe management handlers
  const handleRemoveRecipeFromCollection = async (recipeId: string, recipeName: string) => {
    // Use managingCollectionId if side panel is open, otherwise use selectedCollection
    const collectionId = managingCollectionId || selectedCollection;
    if (!collectionId) return;

    if (!confirm(`Remove "${recipeName}" from this collection?`)) return;

    setSavingRecipes(recipeId);

    try {
      await collectionApi.removeRecipe(collectionId, recipeId);
      setCollectionRecipeIds(prev => {
        const next = new Set(prev);
        next.delete(recipeId);
        return next;
      });
      // Update collection count
      setCollections(prev => prev.map(c =>
        c.id === collectionId
          ? { ...c, recipe_count: c.recipe_count - 1 }
          : c
      ));
      // Remove from displayed recipes if viewing this collection
      if (selectedCollection === collectionId) {
        setAllRecipes(prev => prev.filter(r => r.id !== recipeId));
      }
    } catch (error) {
      console.error('Failed to remove recipe from collection:', error);
    } finally {
      setSavingRecipes(null);
    }
  };

  const togglePrivacy = async (recipe: RecipeSummary, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const newPrivacy = recipe.privacy_level === 'public' ? 'private' : 'public';
      await recipeApi.update(recipe.id, { privacy_level: newPrivacy });
      setAllRecipes(prev => prev.map(r =>
        r.id === recipe.id ? { ...r, privacy_level: newPrivacy } : r
      ));
    } catch (error) {
      console.error('Failed to update privacy:', error);
    }
  };

  const selectedCollectionName = selectedCollection
    ? collections.find(c => c.id === selectedCollection)?.name
    : null;

  const managingCollection = managingCollectionId
    ? collections.find(c => c.id === managingCollectionId)
    : null;

  // Get all user recipes for the management panel
  const [allUserRecipes, setAllUserRecipes] = useState<RecipeSummary[]>([]);
  useEffect(() => {
    if (managingCollectionId) {
      recipeApi.list({ page: 1, page_size: 500 }).then(res => {
        setAllUserRecipes(res.items);
      });
    }
  }, [managingCollectionId]);

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* Left Sidebar - Collections */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-charcoal">Collections</h2>
                <button
                  onClick={() => setIsManageMode(!isManageMode)}
                  className={`text-xs transition-colors ${isManageMode ? 'text-gold font-medium' : 'text-warm-gray hover:text-gold'}`}
                >
                  {isManageMode ? 'Done' : 'Manage'}
                </button>
              </div>

              <nav className="space-y-1">
                {!isManageMode && (
                  <button
                    onClick={() => handleCollectionClick(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      !selectedCollection
                        ? 'bg-gold/10 text-gold-dark font-medium'
                        : 'text-charcoal hover:bg-cream-dark'
                    }`}
                  >
                    All Recipes
                  </button>
                )}

                {loadingCollections ? (
                  <div className="px-3 py-2">
                    <div className="animate-pulse h-4 bg-cream-dark rounded w-3/4" />
                  </div>
                ) : (
                  collections.map(collection => (
                    <div key={collection.id} className="group relative">
                      {editingCollectionId === collection.id ? (
                        <div className="flex items-center gap-1 px-2">
                          <input
                            ref={editCollectionInputRef}
                            type="text"
                            value={editingCollectionName}
                            onChange={(e) => setEditingCollectionName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateCollection(collection.id);
                              if (e.key === 'Escape') {
                                setEditingCollectionId(null);
                                setEditingCollectionName('');
                              }
                            }}
                            className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
                            disabled={savingCollection}
                          />
                          <button
                            onClick={() => handleUpdateCollection(collection.id)}
                            disabled={savingCollection}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingCollectionId(null);
                              setEditingCollectionName('');
                            }}
                            className="p-1 text-warm-gray hover:text-charcoal"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : isManageMode ? (
                        <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-cream-dark group/item">
                          {/* Drag Handle */}
                          <div className="flex-shrink-0 cursor-grab text-warm-gray/40 hover:text-warm-gray">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>

                          {/* Name and Privacy */}
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => setManagingCollectionId(collection.id)}
                              className="block w-full text-left truncate text-charcoal hover:text-gold transition-colors"
                            >
                              {collection.name}
                            </button>
                            <button
                              onClick={() => toggleCollectionPrivacy(collection)}
                              className={`text-[10px] font-medium transition-colors ${
                                collection.privacy_level === 'public'
                                  ? 'text-green-600 hover:text-green-700'
                                  : 'text-warm-gray hover:text-charcoal'
                              }`}
                              title={`Click to make ${collection.privacy_level === 'public' ? 'private' : 'public'}`}
                            >
                              {collection.privacy_level === 'public' ? 'Public' : 'Private'}
                            </button>
                          </div>

                          {/* Edit/Delete Actions */}
                          {!collection.is_default && (
                            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditingCollection(collection)}
                                className="p-1 text-warm-gray hover:text-gold"
                                title="Rename"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteCollection(collection.id)}
                                className="p-1 text-warm-gray hover:text-red-500"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCollectionClick(collection.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selectedCollection === collection.id
                              ? 'bg-gold/10 text-gold-dark font-medium'
                              : 'text-charcoal hover:bg-cream-dark'
                          }`}
                        >
                          <span className="truncate">{collection.name}</span>
                        </button>
                      )}
                    </div>
                  ))
                )}

                {/* New Collection Input */}
                {isCreatingCollection ? (
                  <div className="flex items-center gap-1 px-2">
                    <input
                      ref={newCollectionInputRef}
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateCollection();
                        if (e.key === 'Escape') {
                          setIsCreatingCollection(false);
                          setNewCollectionName('');
                        }
                      }}
                      placeholder="Collection name..."
                      className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
                      disabled={savingCollection}
                    />
                    <button
                      onClick={handleCreateCollection}
                      disabled={savingCollection || !newCollectionName.trim()}
                      className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingCollection(false);
                        setNewCollectionName('');
                      }}
                      className="p-1 text-warm-gray hover:text-charcoal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreatingCollection(true)}
                    className="block w-full text-left px-3 py-2 text-sm text-gold hover:text-gold-dark"
                  >
                    + New Collection
                  </button>
                )}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="font-serif text-2xl text-charcoal">
                  {selectedCollectionName || 'All Recipes'}
                </h1>
                {!loading && (
                  <p className="text-sm text-warm-gray mt-1">
                    {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
                    {(searchQuery || selectedTags.length > 0) && ' filtered'}
                  </p>
                )}
              </div>
              <Link href="/recipes/new" className="btn-primary">
                + New Recipe
              </Link>
            </div>

            {/* Spotlight Filter */}
            <div className="mb-6 space-y-3">
              <div className="relative inline-flex items-center">
                <svg
                  className="w-4 h-4 text-warm-gray/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-charcoal placeholder:text-warm-gray/50 pl-2 pr-6 py-1 w-40 focus:w-64 transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-0 text-warm-gray/60 hover:text-charcoal"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
              </div>

              {/* Tag Pills with AND/OR Toggle */}
              {availableTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-gold text-white'
                          : 'bg-cream-dark text-charcoal hover:bg-gold/20'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {selectedTags.length > 1 && (
                    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
                      <span className="text-xs text-warm-gray">Match:</span>
                      <button
                        onClick={() => setTagFilterMode(tagFilterMode === 'all' ? 'any' : 'all')}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-cream-dark text-charcoal hover:bg-gold/20 transition-colors"
                      >
                        {tagFilterMode === 'all' ? 'All tags' : 'Any tag'}
                      </button>
                    </div>
                  )}
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recipe Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-3" />
                    <div className="h-4 bg-cream-dark rounded w-3/4 mb-2" />
                    <div className="h-3 bg-cream-dark rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
                  <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-charcoal mb-2">
                  {(searchQuery || selectedTags.length > 0)
                    ? 'No recipes match your filters'
                    : selectedCollection
                    ? 'No recipes in this collection'
                    : 'No recipes yet'}
                </h3>
                <p className="text-warm-gray mb-6">
                  {(searchQuery || selectedTags.length > 0)
                    ? 'Try adjusting your search or clearing filters'
                    : selectedCollection
                    ? 'Add some recipes to this collection to see them here'
                    : 'Create your first recipe to get started'
                  }
                </p>
                {(searchQuery || selectedTags.length > 0) ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTags([]);
                    }}
                    className="btn-secondary"
                  >
                    Clear Filters
                  </button>
                ) : !selectedCollection && (
                  <Link href="/recipes/new" className="btn-primary">
                    + New Recipe
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecipes.map(recipe => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="group"
                  >
                    <div className="aspect-[4/3] rounded-lg overflow-hidden mb-3 bg-cream-dark relative">
                      {recipe.cover_image_url ? (
                        <img
                          src={recipe.cover_image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {/* Remove from Collection Button - shown in manage mode when viewing a collection */}
                      {isManageMode && selectedCollection && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveRecipeFromCollection(recipe.id, recipe.title);
                          }}
                          disabled={savingRecipes === recipe.id}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                          title="Remove from collection"
                        >
                          {savingRecipes === recipe.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      )}
                      {/* Privacy Badge - hide in manage mode when viewing a collection */}
                      {!(isManageMode && selectedCollection) && (
                        <button
                          onClick={(e) => togglePrivacy(recipe, e)}
                          className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            recipe.privacy_level === 'public'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={`Click to make ${recipe.privacy_level === 'public' ? 'private' : 'public'}`}
                        >
                          {recipe.privacy_level === 'public' ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Public
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Private
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                    <h3 className="font-serif text-lg text-charcoal group-hover:text-gold transition-colors mb-1">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-sm text-warm-gray line-clamp-2 mb-2">{recipe.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-warm-gray">
                      {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                        <span>{(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min</span>
                      )}
                      {recipe.difficulty && (
                        <span className={`capitalize ${
                          recipe.difficulty === 'easy' ? 'text-green-600' :
                          recipe.difficulty === 'medium' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {recipe.difficulty}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!selectedCollection && totalPages > 1 && !searchQuery && selectedTags.length === 0 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-charcoal hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 text-sm text-warm-gray">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-charcoal hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </main>

          {/* Right Panel - Recipe Management */}
          {managingCollectionId && (
            <aside className="hidden lg:block w-80 flex-shrink-0">
              <div className="sticky top-24 bg-white border border-border rounded-lg p-4 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg text-charcoal">
                    {managingCollection?.name}
                  </h3>
                  <button
                    onClick={() => setManagingCollectionId(null)}
                    className="text-warm-gray hover:text-charcoal"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 -mx-4 px-4">
                  <p className="text-xs text-warm-gray mb-3">
                    {collectionRecipeIds.size} recipe{collectionRecipeIds.size !== 1 ? 's' : ''} in this collection
                  </p>
                  <div className="space-y-2">
                    {allUserRecipes
                      .filter(r => collectionRecipeIds.has(r.id))
                      .map(recipe => (
                        <div
                          key={recipe.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream group/item"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-charcoal truncate">{recipe.title}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveRecipeFromCollection(recipe.id, recipe.title)}
                            disabled={savingRecipes === recipe.id}
                            className="text-warm-gray hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all disabled:opacity-50"
                            title="Remove from collection"
                          >
                            {savingRecipes === recipe.id ? (
                              <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    {collectionRecipeIds.size === 0 && (
                      <p className="text-sm text-warm-gray italic py-4 text-center">
                        No recipes in this collection
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile Collections Drawer Trigger */}
      <div className="lg:hidden fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setIsManageMode(!isManageMode)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-full shadow-lg text-sm text-charcoal"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Collections
        </button>
      </div>
    </div>
  );
}
