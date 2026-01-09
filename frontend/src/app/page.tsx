'use client';

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi, collectionApi, socialApi, mealPlanApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import RecipeSearchModal from '@/components/search/RecipeSearchModal';
import { CalendarView } from '@/components/calendar';
import { ShareModal } from '@/components/sharing';
import { CollectionSidebar } from '@/components/collections';
import { RecipeFilterSection, RecipeGrid } from '@/components/recipes';
import type { RecipeSummary, Collection, Tag, SharedCollection, CollectionShare, UserSearchResult, SearchRecipeResult, MealPlanShare } from '@/types';

type PageView = 'recipes' | 'calendar';

function RecipesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Page view toggle - read from URL param
  const viewParam = searchParams.get('view');
  const [pageView, setPageView] = useState<PageView>(viewParam === 'calendar' ? 'calendar' : 'recipes');

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
  const [recipeViewMode, setRecipeViewMode] = useState<'grid' | 'table'>('table');

  // Shared collections state
  const [sharedCollections, setSharedCollections] = useState<SharedCollection[]>([]);

  // Sharing modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shares, setShares] = useState<CollectionShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sharingUser, setSharingUser] = useState<string | null>(null);

  // Add recipes modal state
  const [isAddRecipesModalOpen, setIsAddRecipesModalOpen] = useState(false);

  // Calendar sharing state
  const [isCalendarShareModalOpen, setIsCalendarShareModalOpen] = useState(false);
  const [calendarShares, setCalendarShares] = useState<MealPlanShare[]>([]);
  const [loadingCalendarShares, setLoadingCalendarShares] = useState(false);
  const [calendarUserSearchQuery, setCalendarUserSearchQuery] = useState('');
  const [calendarUserSearchResults, setCalendarUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingCalendarUsers, setSearchingCalendarUsers] = useState(false);
  const [sharingCalendarUser, setSharingCalendarUser] = useState<string | null>(null);


  // Track previous URL param to detect actual URL changes vs re-renders
  const prevUrlCollectionRef = useRef<string | null | undefined>(undefined);

  // AbortController for cancelling stale recipe fetches
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  // Sync page view with URL param
  useEffect(() => {
    const newView = viewParam === 'calendar' ? 'calendar' : 'recipes';
    if (newView !== pageView) {
      setPageView(newView);
    }
  }, [viewParam]);

  // Load collections on mount
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const [ownCollections, shared] = await Promise.all([
        collectionApi.list(),
        collectionApi.listSharedWithMe(),
      ]);
      setCollections(ownCollections);
      setSharedCollections(shared);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  // Read collection from URL query parameter on initial load only
  useEffect(() => {
    if (!loadingCollections && !initialCollectionLoaded) {
      const collectionParam = searchParams.get('collection');
      const isOwnCollection = collections.some(c => c.id === collectionParam);
      const isSharedCollection = sharedCollections.some(c => c.id === collectionParam);
      if (collectionParam && (isOwnCollection || isSharedCollection)) {
        setSelectedCollection(collectionParam);
      }
      prevUrlCollectionRef.current = collectionParam;
      setInitialCollectionLoaded(true);
    }
  }, [loadingCollections, initialCollectionLoaded, collections, sharedCollections, searchParams]);

  // Handle external URL changes (e.g., browser back/forward, clicking logo)
  useEffect(() => {
    if (!initialCollectionLoaded) return;

    const collectionParam = searchParams.get('collection');
    // Only react if URL actually changed externally
    if (prevUrlCollectionRef.current !== collectionParam) {
      prevUrlCollectionRef.current = collectionParam;
      if (!collectionParam) {
        setSelectedCollection(null);
      } else {
        const isOwnCollection = collections.some(c => c.id === collectionParam);
        const isSharedCollection = sharedCollections.some(c => c.id === collectionParam);
        if (isOwnCollection || isSharedCollection) {
          setSelectedCollection(collectionParam);
        }
      }
    }
  }, [searchParams, initialCollectionLoaded, collections, sharedCollections]);

  // Update URL when collection changes from sidebar clicks
  const updateUrlForCollection = useCallback((collectionId: string | null) => {
    const url = collectionId
      ? `/?collection=${collectionId}`
      : '/';
    prevUrlCollectionRef.current = collectionId;
    router.replace(url, { scroll: false });
  }, [router]);

  // Load recipes when collection or page changes - with request cancellation
  useEffect(() => {
    // Cancel any in-flight request
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;

    const fetchRecipesWithAbort = async () => {
      setLoading(true);
      try {
        if (selectedCollection) {
          const collection = await collectionApi.get(selectedCollection);
          if (!abortController.signal.aborted) {
            setAllRecipes(collection.recipes);
            setTotalPages(1);
          }
        } else {
          const response = await recipeApi.list({
            page: currentPage,
            page_size: 100,
          });
          if (!abortController.signal.aborted) {
            setAllRecipes(response.items);
            setTotalPages(response.total_pages);
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Failed to fetch recipes:', error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // Clear filters when collection changes
    setSearchQuery('');
    setSelectedTags([]);

    fetchRecipesWithAbort();

    return () => {
      abortController.abort();
    };
  }, [currentPage, selectedCollection]);

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

  // Calendar sharing handlers
  const loadCalendarShares = async () => {
    setLoadingCalendarShares(true);
    try {
      const data = await mealPlanApi.listShares();
      setCalendarShares(data);
    } catch (error) {
      console.error('Failed to load calendar shares:', error);
    } finally {
      setLoadingCalendarShares(false);
    }
  };

  const openCalendarShareModal = () => {
    setIsCalendarShareModalOpen(true);
    loadCalendarShares();
  };

  // Calendar user search
  useEffect(() => {
    if (!calendarUserSearchQuery.trim()) {
      setCalendarUserSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingCalendarUsers(true);
      try {
        const results = await socialApi.searchUsers(calendarUserSearchQuery, 10);
        const shareUserIds = new Set(calendarShares.map(s => s.shared_with.id));
        setCalendarUserSearchResults(results.filter(u => !shareUserIds.has(u.id)));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchingCalendarUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [calendarUserSearchQuery, calendarShares]);

  const handleShareCalendar = async (userId: string, permission: 'viewer' | 'editor' = 'viewer') => {
    setSharingCalendarUser(userId);
    try {
      const newShare = await mealPlanApi.share({ user_id: userId, permission });
      setCalendarShares(prev => [...prev, newShare]);
      setCalendarUserSearchQuery('');
      setCalendarUserSearchResults([]);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to share calendar');
    } finally {
      setSharingCalendarUser(null);
    }
  };

  const handleUpdateCalendarSharePermission = async (userId: string, permission: 'viewer' | 'editor') => {
    try {
      const updated = await mealPlanApi.updateShare(userId, { permission });
      setCalendarShares(prev => prev.map(s => s.shared_with.id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemoveCalendarShare = async (userId: string) => {
    if (!confirm('Remove this user from your meal plan?')) return;
    try {
      await mealPlanApi.removeShare(userId);
      setCalendarShares(prev => prev.filter(s => s.shared_with.id !== userId));
    } catch (error) {
      console.error('Failed to remove share:', error);
    }
  };

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
    updateUrlForCollection(collectionId);
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

  const selectedCollectionName = selectedCollection
    ? collections.find(c => c.id === selectedCollection)?.name ||
      sharedCollections.find(c => c.id === selectedCollection)?.name
    : null;

  const managingCollection = managingCollectionId
    ? collections.find(c => c.id === managingCollectionId)
    : null;

  // Determine if selected collection is a shared one (not owned by user)
  const selectedSharedCollection = selectedCollection
    ? sharedCollections.find(c => c.id === selectedCollection)
    : null;
  const isSharedCollection = !!selectedSharedCollection;
  const selectedOwnCollection = selectedCollection
    ? collections.find(c => c.id === selectedCollection)
    : null;
  const canShare = selectedOwnCollection || (selectedSharedCollection?.permission === 'editor');
  const canEditCollection = canShare; // Same permission level allows editing recipes in collection

  // Load shares when modal opens
  const loadShares = async () => {
    if (!selectedCollection) return;
    setLoadingShares(true);
    try {
      const data = await collectionApi.listShares(selectedCollection);
      setShares(data);
    } catch (error) {
      console.error('Failed to load shares:', error);
    } finally {
      setLoadingShares(false);
    }
  };

  const openShareModal = () => {
    setIsShareModalOpen(true);
    loadShares();
  };

  // User search for sharing
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const results = await socialApi.searchUsers(userSearchQuery, 10);
        // Filter out users who already have access
        const shareUserIds = new Set(shares.map(s => s.user_id));
        setUserSearchResults(results.filter(u => !shareUserIds.has(u.id)));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearchQuery, shares]);

  const handleShareWithUser = async (userId: string, permission: 'viewer' | 'editor' = 'viewer') => {
    if (!selectedCollection) return;
    setSharingUser(userId);
    try {
      const newShare = await collectionApi.share(selectedCollection, { user_id: userId, permission });
      setShares(prev => [...prev, newShare]);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to share collection');
    } finally {
      setSharingUser(null);
    }
  };

  const handleUpdatePermission = async (userId: string, permission: 'viewer' | 'editor') => {
    if (!selectedCollection) return;
    try {
      const updated = await collectionApi.updateShare(selectedCollection, userId, { permission });
      setShares(prev => prev.map(s => s.user_id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    if (!selectedCollection) return;
    if (!confirm('Remove this user from the collection?')) return;
    try {
      await collectionApi.removeShare(selectedCollection, userId);
      setShares(prev => prev.filter(s => s.user_id !== userId));
    } catch (error) {
      console.error('Failed to remove share:', error);
    }
  };

  const handleLeaveCollection = async () => {
    if (!selectedCollection) return;
    if (!confirm('Leave this collection? You will no longer have access to it.')) return;
    try {
      await collectionApi.leave(selectedCollection);
      setSharedCollections(prev => prev.filter(c => c.id !== selectedCollection));
      setSelectedCollection(null);
    } catch (error) {
      console.error('Failed to leave collection:', error);
    }
  };

  // Get all user recipes for the management panel
  const [allUserRecipes, setAllUserRecipes] = useState<RecipeSummary[]>([]);
  useEffect(() => {
    if (managingCollectionId) {
      recipeApi.list({ page: 1, page_size: 100 }).then(res => {
        setAllUserRecipes(res.items);
      });
    }
  }, [managingCollectionId]);

  // Load collection recipe IDs when add recipes modal opens
  useEffect(() => {
    if (isAddRecipesModalOpen && selectedCollection) {
      loadCollectionRecipes(selectedCollection);
    }
  }, [isAddRecipesModalOpen, selectedCollection]);

  // Handler for adding a recipe to collection (used by RecipeSearchModal)
  const handleAddRecipeToCollection = async (recipe: SearchRecipeResult) => {
    if (!selectedCollection) return;
    try {
      await collectionApi.addRecipe(selectedCollection, recipe.id);
      setCollectionRecipeIds(prev => new Set([...prev, recipe.id]));
      // Update collection count
      setCollections(prev => prev.map(c =>
        c.id === selectedCollection
          ? { ...c, recipe_count: c.recipe_count + 1 }
          : c
      ));
      // Fetch the full recipe data to add to display
      const fullRecipe = await recipeApi.get(recipe.id);
      setAllRecipes(prev => [...prev, fullRecipe]);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to add recipe to collection');
      throw error; // Re-throw so the modal knows it failed
    }
  };

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* Left Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              {/* View Toggle */}
              <div className="flex rounded-lg bg-cream-dark p-1 mb-4">
                <button
                  onClick={() => setPageView('recipes')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pageView === 'recipes'
                      ? 'bg-white text-charcoal shadow-sm'
                      : 'text-warm-gray hover:text-charcoal'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Recipes
                </button>
                <button
                  onClick={() => setPageView('calendar')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pageView === 'calendar'
                      ? 'bg-white text-charcoal shadow-sm'
                      : 'text-warm-gray hover:text-charcoal'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Meal Plan
                </button>
              </div>

              {/* Grocery List Link */}
              <Link
                href="/grocery"
                className="flex items-center gap-2 px-3 py-2 mb-4 text-sm font-medium text-warm-gray hover:text-charcoal hover:bg-cream-dark rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Grocery List
              </Link>

              {/* Recipe sidebar content - only show when in recipes view */}
              {pageView === 'recipes' && (
                <CollectionSidebar
                  collections={collections}
                  sharedCollections={sharedCollections}
                  selectedCollection={selectedCollection}
                  loadingCollections={loadingCollections}
                  isManageMode={isManageMode}
                  onToggleManageMode={() => setIsManageMode(!isManageMode)}
                  onCollectionClick={handleCollectionClick}
                  isCreatingCollection={isCreatingCollection}
                  newCollectionName={newCollectionName}
                  savingCollection={savingCollection}
                  onStartCreate={() => setIsCreatingCollection(true)}
                  onCancelCreate={() => {
                    setIsCreatingCollection(false);
                    setNewCollectionName('');
                  }}
                  onNewCollectionNameChange={setNewCollectionName}
                  onCreateCollection={handleCreateCollection}
                  editingCollectionId={editingCollectionId}
                  editingCollectionName={editingCollectionName}
                  onStartEdit={startEditingCollection}
                  onCancelEdit={() => {
                    setEditingCollectionId(null);
                    setEditingCollectionName('');
                  }}
                  onEditNameChange={setEditingCollectionName}
                  onUpdateCollection={handleUpdateCollection}
                  onDeleteCollection={handleDeleteCollection}
                  onTogglePrivacy={toggleCollectionPrivacy}
                  onManageRecipes={setManagingCollectionId}
                />
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {pageView === 'recipes' ? (
            <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-serif text-2xl text-charcoal">
                    {selectedCollectionName || 'All Recipes'}
                  </h1>
                  {/* Shared badge for shared collections */}
                  {isSharedCollection && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      Shared by {selectedSharedCollection?.owner.name}
                    </span>
                  )}
                </div>
                {!loading && (
                  <p className="text-sm text-warm-gray mt-1">
                    {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
                    {(searchQuery || selectedTags.length > 0) && ' filtered'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Collection action buttons */}
                {selectedCollection && (
                  <>
                    {canEditCollection && (
                      <button
                        onClick={() => setIsAddRecipesModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-charcoal hover:border-gold transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Recipes
                      </button>
                    )}
                    {canShare && (
                      <button
                        onClick={openShareModal}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-charcoal hover:border-gold transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Share
                      </button>
                    )}
                    {isSharedCollection && (
                      <button
                        onClick={handleLeaveCollection}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Leave
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Spotlight Filter */}
            <RecipeFilterSection
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              availableTags={availableTags}
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
              onClearTags={() => setSelectedTags([])}
              tagFilterMode={tagFilterMode}
              onToggleTagFilterMode={() => setTagFilterMode(tagFilterMode === 'all' ? 'any' : 'all')}
              viewMode={recipeViewMode}
              onViewModeChange={setRecipeViewMode}
            />

            {/* Recipe Grid */}
            <RecipeGrid
              recipes={filteredRecipes}
              loading={loading}
              emptyState={{
                hasFilters: !!(searchQuery || selectedTags.length > 0),
                hasCollection: !!selectedCollection,
                onClearFilters: () => {
                  setSearchQuery('');
                  setSelectedTags([]);
                },
              }}
              manageMode={{
                enabled: isManageMode,
                selectedCollection,
                savingRecipeId: savingRecipes,
                onRemoveRecipe: handleRemoveRecipeFromCollection,
              }}
              viewMode={recipeViewMode}
            />

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
            </>
            ) : (
              <CalendarView isActive={pageView === 'calendar'} onOpenShareModal={openCalendarShareModal} />
            )}
          </main>

          {/* Right Panel - Recipe Management */}
          {pageView === 'recipes' && managingCollectionId && (
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

      {/* Floating Action Button - New Recipe (desktop only, mobile uses bottom nav) */}
      {pageView === 'recipes' && (
      <Link
        href={selectedCollection ? `/recipes/new?collection=${selectedCollection}` : "/recipes/new"}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gold hover:bg-gold-dark text-white rounded-full shadow-lg hover:shadow-xl hidden md:flex items-center justify-center transition-all duration-200 hover:scale-105"
        title="New Recipe"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </Link>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Share Collection"
        shares={shares}
        loadingShares={loadingShares}
        searchQuery={userSearchQuery}
        onSearchQueryChange={setUserSearchQuery}
        searchResults={userSearchResults}
        searching={searchingUsers}
        sharingUserId={sharingUser}
        onShareWithUser={handleShareWithUser}
        onUpdatePermission={handleUpdatePermission}
        onRemoveShare={handleRemoveShare}
      />

      {/* Add Recipes Modal */}
      <RecipeSearchModal
        isOpen={isAddRecipesModalOpen}
        onClose={() => setIsAddRecipesModalOpen(false)}
        onSelectRecipe={handleAddRecipeToCollection}
        excludeRecipeIds={collectionRecipeIds}
        title="Add Recipe to Collection"
      />

      {/* Calendar Share Modal */}
      <ShareModal
        isOpen={isCalendarShareModalOpen}
        onClose={() => {
          setIsCalendarShareModalOpen(false);
          setCalendarUserSearchQuery('');
          setCalendarUserSearchResults([]);
        }}
        title="Share Meal Plan"
        shares={calendarShares.map(s => ({
          id: s.id,
          user_id: s.shared_with.id,
          user: s.shared_with,
          permission: s.permission,
        }))}
        loadingShares={loadingCalendarShares}
        searchQuery={calendarUserSearchQuery}
        onSearchQueryChange={setCalendarUserSearchQuery}
        searchResults={calendarUserSearchResults}
        searching={searchingCalendarUsers}
        sharingUserId={sharingCalendarUser}
        onShareWithUser={handleShareCalendar}
        onUpdatePermission={handleUpdateCalendarSharePermission}
        onRemoveShare={handleRemoveCalendarShare}
      />

    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-cream-dark rounded w-48 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-3" />
                  <div className="h-4 bg-cream-dark rounded w-3/4 mb-2" />
                  <div className="h-3 bg-cream-dark rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <RecipesPageContent />
    </Suspense>
  );
}
