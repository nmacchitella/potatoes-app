'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { collectionApi } from '@/lib/api';
import { UserAvatar } from '@/components/ui';
import type { Collection, SharedCollection } from '@/types';

type CalendarMode = 'day' | 'week' | 'month';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  groceryLists?: import('@/types').GroceryListSummary[];
  sharedGroceryLists?: import('@/types').SharedGroceryListAccess[];
  selectedListId?: string | null;
  onSelectList?: (id: string) => void;
  onCreateList?: (name?: string) => Promise<import('@/types').GroceryListSummary>;
  onRenameList?: (listId: string, name: string) => Promise<void>;
  onDeleteList?: (listId: string) => Promise<void>;
  onAcceptShare?: (shareId: string) => Promise<void>;
  onDeclineShare?: (shareId: string) => Promise<void>;
  onLeaveSharedList?: (shareId: string) => Promise<void>;
  loadingLists?: boolean;
}

export default function MobileSidebar({
  isOpen,
  onClose,
  groceryLists,
  sharedGroceryLists,
  selectedListId,
  onSelectList,
  onCreateList,
  onRenameList,
  onDeleteList,
  onAcceptShare,
  onDeclineShare,
  onLeaveSharedList,
  loadingLists,
}: MobileSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useStore();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [sharedCollections, setSharedCollections] = useState<SharedCollection[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline collection management state
  const [isManageMode, setIsManageMode] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  // Grocery list management state
  const [isCreatingGroceryList, setIsCreatingGroceryList] = useState(false);
  const [newGroceryListName, setNewGroceryListName] = useState('');
  const [editingGroceryListId, setEditingGroceryListId] = useState<string | null>(null);
  const [editingGroceryListName, setEditingGroceryListName] = useState('');

  const newCollectionInputRef = useRef<HTMLInputElement>(null);
  const editCollectionInputRef = useRef<HTMLInputElement>(null);
  const newGroceryListInputRef = useRef<HTMLInputElement>(null);
  const editGroceryListInputRef = useRef<HTMLInputElement>(null);

  const selectedCollection = searchParams.get('collection');
  const modeParam = searchParams.get('mode');
  const isOnGroceryPage = pathname === '/grocery';
  const isOnCalendarPage = pathname === '/calendar';
  const isOnRecipesPage = pathname === '/' || pathname.startsWith('/?');
  const calendarMode: CalendarMode = (modeParam === 'day' || modeParam === 'month') ? modeParam : 'week';

  // Load collections on mount
  useEffect(() => {
    if (isOpen && user) {
      loadCollections();
    }
  }, [isOpen, user]);

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
      setLoading(false);
    }
  };

  const handleCollectionClick = (collectionId: string | null) => {
    const url = collectionId
      ? `/?collection=${collectionId}`
      : '/';
    router.push(url);
    onClose();
  };

  const handleCalendarModeChange = (mode: CalendarMode) => {
    router.push(`/calendar?mode=${mode}`);
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    router.push('/auth/login');
  };

  const handleNavClick = (href: string) => {
    router.push(href);
    onClose();
  };

  // Collection management functions
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
        router.push('/');
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete collection');
    }
  };

  const startEditingCollection = (collection: Collection) => {
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  };

  // Grocery list management functions
  const handleCreateGroceryList = async () => {
    if (!newGroceryListName.trim() || !onCreateList) return;
    try {
      await onCreateList(newGroceryListName.trim());
      setNewGroceryListName('');
      setIsCreatingGroceryList(false);
    } catch (error) {
      console.error('Failed to create grocery list:', error);
    }
  };

  const handleUpdateGroceryList = async (listId: string) => {
    if (!editingGroceryListName.trim() || !onRenameList) return;
    try {
      await onRenameList(listId, editingGroceryListName.trim());
      setEditingGroceryListId(null);
      setEditingGroceryListName('');
    } catch (error) {
      console.error('Failed to update grocery list:', error);
    }
  };

  const handleDeleteGroceryList = async (listId: string) => {
    if (!confirm('Delete this grocery list?') || !onDeleteList) return;
    try {
      await onDeleteList(listId);
    } catch (error) {
      console.error('Failed to delete grocery list:', error);
    }
  };

  const startEditingGroceryList = (list: import('@/types').GroceryListSummary) => {
    setEditingGroceryListId(list.id);
    setEditingGroceryListName(list.name);
  };

  const handleGroceryListClick = (listId: string) => {
    if (onSelectList) {
      onSelectList(listId);
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 bg-cream z-50 md:hidden transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link
              href="/"
              onClick={() => { handleCollectionClick(null); }}
              className="font-serif text-xl text-charcoal"
            >
              Potatoes
            </Link>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-warm-gray hover:text-charcoal transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Profile Section */}
          <div className="p-4 border-b border-border">
            <button
              onClick={() => handleNavClick(`/profile/${user?.id}`)}
              className="flex items-center gap-3 w-full text-left"
            >
              <UserAvatar user={user} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-charcoal truncate">{user?.name}</p>
                <p className="text-sm text-warm-gray truncate">View profile</p>
              </div>
              <svg className="w-5 h-5 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Main Navigation */}
            <div className="p-4 space-y-1 border-b border-border">
              <button
                onClick={() => handleNavClick('/')}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isOnRecipesPage
                    ? 'bg-gold/10 text-gold-dark font-medium'
                    : 'text-charcoal hover:bg-cream-dark'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Recipes</span>
              </button>
              <button
                onClick={() => handleNavClick('/calendar')}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isOnCalendarPage
                    ? 'bg-gold/10 text-gold-dark font-medium'
                    : 'text-charcoal hover:bg-cream-dark'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Meal Plan</span>
              </button>
              <button
                onClick={() => handleNavClick('/grocery')}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isOnGroceryPage
                    ? 'bg-gold/10 text-gold-dark font-medium'
                    : 'text-charcoal hover:bg-cream-dark'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Grocery List</span>
              </button>
            </div>

            {/* Grocery List Management - Only show when on grocery page */}
            {isOnGroceryPage && groceryLists && (
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-warm-gray uppercase tracking-wide">
                    My Lists
                  </span>
                  <button
                    onClick={() => setIsCreatingGroceryList(true)}
                    className="text-xs text-gold hover:text-gold-dark"
                  >
                    + New
                  </button>
                </div>

                {loadingLists ? (
                  <div className="py-4 text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent mx-auto" />
                  </div>
                ) : (
                  <>
                    {/* Create new grocery list form */}
                    {isCreatingGroceryList && (
                      <div className="mb-3 p-2 bg-cream-dark rounded-lg">
                        <input
                          ref={newGroceryListInputRef}
                          type="text"
                          value={newGroceryListName}
                          onChange={(e) => setNewGroceryListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateGroceryList();
                            if (e.key === 'Escape') {
                              setIsCreatingGroceryList(false);
                              setNewGroceryListName('');
                            }
                          }}
                          placeholder="List name..."
                          className="w-full px-2 py-1.5 text-sm border border-gold rounded focus:outline-none mb-2"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateGroceryList}
                            disabled={!newGroceryListName.trim()}
                            className="flex-1 px-2 py-1 text-xs bg-gold text-white rounded hover:bg-gold-dark disabled:opacity-50"
                          >
                            Create
                          </button>
                          <button
                            onClick={() => {
                              setIsCreatingGroceryList(false);
                              setNewGroceryListName('');
                            }}
                            className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Grocery lists */}
                    <div className="space-y-0.5">
                      {groceryLists.map((list) => (
                        <div key={list.id}>
                          {editingGroceryListId === list.id ? (
                            <div className="flex items-center gap-1 p-2 bg-cream-dark rounded-lg">
                              <input
                                ref={editGroceryListInputRef}
                                type="text"
                                value={editingGroceryListName}
                                onChange={(e) => setEditingGroceryListName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateGroceryList(list.id);
                                  if (e.key === 'Escape') {
                                    setEditingGroceryListId(null);
                                    setEditingGroceryListName('');
                                  }
                                }}
                                className="flex-1 px-2 py-1 text-sm border border-gold rounded focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateGroceryList(list.id)}
                                className="p-1 text-green-600 hover:text-green-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingGroceryListId(null);
                                  setEditingGroceryListName('');
                                }}
                                className="p-1 text-warm-gray hover:text-charcoal"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                              selectedListId === list.id
                                ? 'bg-charcoal/5 text-charcoal font-medium'
                                : 'hover:bg-cream-dark'
                            }`}>
                              <button
                                onClick={() => handleGroceryListClick(list.id)}
                                className="flex-1 text-left text-sm"
                              >
                                {list.name}
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEditingGroceryList(list)}
                                  className="p-1 text-warm-gray hover:text-gold"
                                  title="Rename"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteGroceryList(list.id)}
                                  className="p-1 text-warm-gray hover:text-red-500"
                                  title="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Shared with me section */}
                    {sharedGroceryLists && sharedGroceryLists.length > 0 && (
                      <div className="mt-4">
                        <span className="text-xs font-medium text-warm-gray uppercase tracking-wide block mb-2">
                          Shared with me
                        </span>
                        <div className="space-y-0.5">
                          {sharedGroceryLists.filter(s => s.status === 'accepted').map((shared) => (
                            <button
                              key={shared.id}
                              onClick={() => handleGroceryListClick(shared.grocery_list_id)}
                              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                                selectedListId === shared.grocery_list_id
                                  ? 'bg-charcoal/5 text-charcoal font-medium'
                                  : 'hover:bg-cream-dark'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="block truncate">{shared.grocery_list_name}</span>
                                <span className="text-[10px] text-warm-gray">by {shared.owner.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending invitations */}
                    {sharedGroceryLists && sharedGroceryLists.filter(s => s.status === 'pending').length > 0 && (
                      <div className="mt-4">
                        <span className="text-xs font-medium text-warm-gray uppercase tracking-wide block mb-2">
                          Pending Invites
                        </span>
                        <div className="space-y-2">
                          {sharedGroceryLists.filter(s => s.status === 'pending').map((shared) => (
                            <div key={shared.id} className="p-2 bg-cream-dark rounded-lg">
                              <p className="text-sm font-medium text-charcoal truncate">{shared.grocery_list_name}</p>
                              <p className="text-xs text-warm-gray mb-2">by {shared.owner.name}</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (onAcceptShare) onAcceptShare(shared.id);
                                  }}
                                  className="flex-1 px-2 py-1 text-xs bg-gold text-white rounded hover:bg-gold-dark"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => {
                                    if (onDeclineShare) onDeclineShare(shared.id);
                                  }}
                                  className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Calendar View Options - Only show when on calendar page */}
            {isOnCalendarPage && (
              <div className="p-4 border-b border-border">
                <span className="text-xs font-medium text-warm-gray uppercase tracking-wide block mb-3">
                  View
                </span>
                <div className="space-y-0.5">
                  {([
                    { mode: 'day' as CalendarMode, label: 'Day', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                    { mode: 'week' as CalendarMode, label: '3 Days', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                    { mode: 'month' as CalendarMode, label: 'Month', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V10z' },
                  ]).map(({ mode, label, icon }) => (
                    <button
                      key={mode}
                      onClick={() => handleCalendarModeChange(mode)}
                      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors ${
                        calendarMode === mode
                          ? 'bg-charcoal/5 text-charcoal font-medium'
                          : 'text-charcoal hover:bg-cream-dark'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                      </svg>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collections - Only show when on recipes page */}
            {isOnRecipesPage && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-warm-gray uppercase tracking-wide">
                  Collections
                </span>
                {collections.length > 0 && (
                  <button
                    onClick={() => setIsManageMode(!isManageMode)}
                    className={`text-xs ${isManageMode ? 'text-gold' : 'text-warm-gray hover:text-gold'}`}
                  >
                    {isManageMode ? 'Done' : 'Manage'}
                  </button>
                )}
              </div>

              <nav className="space-y-0.5">
                {loading ? (
                  <div className="py-4 text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent mx-auto" />
                  </div>
                ) : (
                  <>
                    {/* All Recipes option */}
                    <button
                      onClick={() => handleCollectionClick(null)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        pathname === '/' && !selectedCollection
                          ? 'bg-charcoal/5 text-charcoal font-medium'
                          : 'text-charcoal hover:bg-cream-dark'
                      }`}
                    >
                      <span>All</span>
                    </button>

                    {/* User collections */}
                    {collections.map(collection => (
                          <div
                            key={collection.id}
                            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedCollection === collection.id
                                ? 'bg-charcoal/5 text-charcoal font-medium'
                                : 'text-charcoal hover:bg-cream-dark'
                            }`}
                          >
                            {editingCollectionId === collection.id ? (
                              <div className="flex items-center gap-1 flex-1">
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
                                  className="flex-1 px-2 py-1 text-sm border border-gold rounded focus:outline-none"
                                  disabled={savingCollection}
                                />
                                <button
                                  onClick={() => handleUpdateCollection(collection.id)}
                                  disabled={savingCollection || !editingCollectionName.trim()}
                                  className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
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
                              <div className="flex items-center justify-between w-full">
                                <span className="truncate">{collection.name}</span>
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => startEditingCollection(collection)}
                                    className="p-1 text-warm-gray hover:text-gold"
                                    title="Rename"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleCollectionClick(collection.id)}
                                  className="flex-1 text-left truncate"
                                >
                                  {collection.name}
                                </button>
                                <span className="text-xs text-warm-gray ml-2">{collection.recipe_count}</span>
                              </>
                            )}
                          </div>
                        ))}

                    {/* Shared collections - integrated into main list */}
                    {sharedCollections.map(collection => (
                      <button
                        key={collection.id}
                        onClick={() => handleCollectionClick(collection.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedCollection === collection.id
                            ? 'bg-charcoal/5 text-charcoal font-medium'
                            : 'text-charcoal hover:bg-cream-dark'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{collection.name}</span>
                          {/* Shared icon */}
                          <span title={`Shared by ${collection.owner.name}`}>
                            <svg className="w-3.5 h-3.5 text-warm-gray flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </span>
                          <span className="text-xs text-warm-gray ml-auto">{collection.recipe_count}</span>
                        </span>
                        <span className="text-[10px] text-warm-gray block">by {collection.owner.name}</span>
                      </button>
                    ))}

                      {/* Create new collection inline */}
                      {isCreatingCollection ? (
                        <div className="flex items-center gap-1 px-3 py-2">
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
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left text-gold hover:bg-gold/10 transition-colors mt-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>New collection</span>
                        </button>
                      )}
                    </>
                  )}
                </nav>

            </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 space-y-1">
            <button
              onClick={() => handleNavClick('/settings')}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
                pathname === '/settings'
                  ? 'bg-gold/10 text-gold-dark font-medium'
                  : 'text-charcoal hover:bg-cream-dark'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
