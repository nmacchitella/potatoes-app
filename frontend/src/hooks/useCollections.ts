import { useState, useEffect, useCallback, useRef } from 'react';
import { collectionApi, socialApi, getErrorMessage } from '@/lib/api';
import type { Collection, CollectionShare, UserSearchResult } from '@/types';

interface UseCollectionsReturn {
  // Collections data (includes both own and partner collections via library sharing)
  collections: Collection[];
  loading: boolean;
  selectedCollection: string | null;
  setSelectedCollection: (id: string | null) => void;

  // CRUD state
  isManageMode: boolean;
  setIsManageMode: (mode: boolean) => void;
  isCreatingCollection: boolean;
  setIsCreatingCollection: (creating: boolean) => void;
  newCollectionName: string;
  setNewCollectionName: (name: string) => void;
  editingCollectionId: string | null;
  editingCollectionName: string;
  savingCollection: boolean;
  newCollectionInputRef: React.RefObject<HTMLInputElement>;
  editCollectionInputRef: React.RefObject<HTMLInputElement>;

  // CRUD handlers
  handleCreate: () => Promise<void>;
  handleUpdate: (collectionId: string) => Promise<void>;
  handleDelete: (collectionId: string) => Promise<void>;
  startEditing: (collection: Collection) => void;
  cancelEditing: () => void;
  togglePrivacy: (collection: Collection) => Promise<void>;

  // Collection click handler
  handleCollectionClick: (collectionId: string | null, onSelect?: () => void) => void;

  // Sharing (for explicit collection shares, not library sharing)
  isShareModalOpen: boolean;
  shares: CollectionShare[];
  loadingShares: boolean;
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  userSearchResults: UserSearchResult[];
  searchingUsers: boolean;
  sharingUser: string | null;
  openShareModal: () => void;
  closeShareModal: () => void;
  handleShareWithUser: (userId: string, permission?: 'viewer' | 'editor') => Promise<void>;
  handleUpdatePermission: (userId: string, permission: 'viewer' | 'editor') => Promise<void>;
  handleRemoveShare: (userId: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;

  // Update collection count (for when recipes are added/removed)
  updateCollectionCount: (collectionId: string, delta: number) => void;
}

export function useCollections(): UseCollectionsReturn {
  // Collections data (includes both own and partner collections)
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  // CRUD state
  const [isManageMode, setIsManageMode] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  const newCollectionInputRef = useRef<HTMLInputElement>(null);
  const editCollectionInputRef = useRef<HTMLInputElement>(null);

  // Sharing state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shares, setShares] = useState<CollectionShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sharingUser, setSharingUser] = useState<string | null>(null);

  // Load collections on mount
  // The API now returns both own and partner collections with include_partners=true (default)
  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const allCollections = await collectionApi.list();
      setCollections(allCollections);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Focus input when creating collection
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

  // CRUD handlers
  const handleCreate = useCallback(async () => {
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
  }, [newCollectionName]);

  const handleUpdate = useCallback(async (collectionId: string) => {
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
  }, [editingCollectionName]);

  const handleDelete = useCallback(async (collectionId: string) => {
    if (!confirm('Delete this collection? Recipes will not be deleted.')) return;
    try {
      await collectionApi.delete(collectionId);
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
      }
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'Failed to delete collection'));
    }
  }, [selectedCollection]);

  const startEditing = useCallback((collection: Collection) => {
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingCollectionId(null);
    setEditingCollectionName('');
  }, []);

  const togglePrivacy = useCallback(async (collection: Collection) => {
    try {
      const newPrivacy = collection.privacy_level === 'public' ? 'private' : 'public';
      await collectionApi.update(collection.id, { privacy_level: newPrivacy });
      setCollections(prev => prev.map(c =>
        c.id === collection.id ? { ...c, privacy_level: newPrivacy } : c
      ));
    } catch (error) {
      console.error('Failed to update collection privacy:', error);
    }
  }, []);

  const handleCollectionClick = useCallback((collectionId: string | null, onSelect?: () => void) => {
    if (isManageMode) return;
    setSelectedCollection(collectionId);
    onSelect?.();
  }, [isManageMode]);

  // Sharing handlers (for explicit collection shares)
  const loadShares = useCallback(async () => {
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
  }, [selectedCollection]);

  const openShareModal = useCallback(() => {
    setIsShareModalOpen(true);
    loadShares();
  }, [loadShares]);

  const closeShareModal = useCallback(() => {
    setIsShareModalOpen(false);
    setUserSearchQuery('');
    setUserSearchResults([]);
  }, []);

  // User search effect
  useEffect(() => {
    if (!userSearchQuery.trim() || userSearchQuery.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const results = await socialApi.searchUsers(userSearchQuery);
        setUserSearchResults(results);
      } catch (error) {
        console.error('User search failed:', error);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  const handleShareWithUser = useCallback(async (userId: string, permission: 'viewer' | 'editor' = 'viewer') => {
    if (!selectedCollection) return;
    setSharingUser(userId);
    try {
      const newShare = await collectionApi.share(selectedCollection, { user_id: userId, permission });
      setShares(prev => [...prev, newShare]);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'Failed to share collection'));
    } finally {
      setSharingUser(null);
    }
  }, [selectedCollection]);

  const handleUpdatePermission = useCallback(async (userId: string, permission: 'viewer' | 'editor') => {
    if (!selectedCollection) return;
    try {
      const updated = await collectionApi.updateShare(selectedCollection, userId, { permission });
      setShares(prev => prev.map(s => s.user.id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  }, [selectedCollection]);

  const handleRemoveShare = useCallback(async (userId: string) => {
    if (!selectedCollection) return;
    if (!confirm('Remove this user\'s access to the collection?')) return;
    try {
      await collectionApi.removeShare(selectedCollection, userId);
      setShares(prev => prev.filter(s => s.user.id !== userId));
    } catch (error) {
      console.error('Failed to remove share:', error);
    }
  }, [selectedCollection]);

  const updateCollectionCount = useCallback((collectionId: string, delta: number) => {
    setCollections(prev => prev.map(c =>
      c.id === collectionId
        ? { ...c, recipe_count: c.recipe_count + delta }
        : c
    ));
  }, []);

  return {
    collections,
    loading,
    selectedCollection,
    setSelectedCollection,
    isManageMode,
    setIsManageMode,
    isCreatingCollection,
    setIsCreatingCollection,
    newCollectionName,
    setNewCollectionName,
    editingCollectionId,
    editingCollectionName,
    savingCollection,
    newCollectionInputRef,
    editCollectionInputRef,
    handleCreate,
    handleUpdate,
    handleDelete,
    startEditing,
    cancelEditing,
    togglePrivacy,
    handleCollectionClick,
    isShareModalOpen,
    shares,
    loadingShares,
    userSearchQuery,
    setUserSearchQuery,
    userSearchResults,
    searchingUsers,
    sharingUser,
    openShareModal,
    closeShareModal,
    handleShareWithUser,
    handleUpdatePermission,
    handleRemoveShare,
    refresh: loadCollections,
    updateCollectionCount,
  };
}
