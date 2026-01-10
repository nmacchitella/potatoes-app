'use client';

import { useState, useEffect } from 'react';
import type { GroceryListSummary, SharedGroceryListAccess } from '@/types';
import { getErrorMessage } from '@/lib/api';

interface GroceryListSidebarProps {
  myLists: GroceryListSummary[];
  sharedWithMe: SharedGroceryListAccess[];
  selectedListId: string | null;
  onSelectList: (listId: string) => void;
  onCreateList: (name?: string) => Promise<GroceryListSummary>;
  onRenameList: (listId: string, name: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onAcceptShare: (shareId: string) => Promise<void>;
  onDeclineShare: (shareId: string) => Promise<void>;
  onLeaveSharedList: (shareId: string) => Promise<void>;
  loading: boolean;
}

export function GroceryListSidebar({
  myLists,
  sharedWithMe,
  selectedListId,
  onSelectList,
  onCreateList,
  onRenameList,
  onDeleteList,
  onAcceptShare,
  onDeclineShare,
  onLeaveSharedList,
  loading,
}: GroceryListSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const acceptedShares = sharedWithMe.filter(s => s.status === 'accepted');
  const pendingShares = sharedWithMe.filter(s => s.status === 'pending');

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setError(null);
    try {
      await onCreateList(newListName.trim());
      setNewListName('');
      setIsCreating(false);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to create list');
      setError(message);
    }
  };

  const handleRenameList = async (listId: string) => {
    if (!editingName.trim()) return;
    setError(null);
    try {
      await onRenameList(listId, editingName.trim());
      setEditingListId(null);
      setEditingName('');
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to rename list');
      setError(message);
    }
  };

  const handleDeleteList = async (listId: string) => {
    setError(null);
    try {
      await onDeleteList(listId);
      setShowDeleteConfirm(null);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to delete list');
      setError(message);
      setShowDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="w-64 bg-white border-r border-border p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-cream rounded w-24"></div>
          <div className="h-10 bg-cream rounded"></div>
          <div className="h-10 bg-cream rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 bg-cream flex flex-col h-full">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-warm-gray uppercase tracking-wide">
            My Lists
          </span>
          <button
            onClick={() => setIsCreating(true)}
            className="text-xs text-gold hover:text-gold-dark transition-colors"
          >
            + New
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Create new list form */}
        {isCreating && (
          <div className="mb-3 p-2 bg-cream-dark rounded-lg">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateList(e as any);
                }
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewListName('');
                }
              }}
              placeholder="List name..."
              className="w-full px-2 py-1.5 text-sm border border-gold rounded focus:outline-none mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={(e) => handleCreateList(e as any)}
                disabled={!newListName.trim()}
                className="flex-1 px-2 py-1 text-xs bg-gold text-white rounded hover:bg-gold-dark disabled:opacity-50"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewListName(''); }}
                className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Grocery lists */}
        <div className="space-y-0.5">
          {myLists.length === 0 ? (
            <p className="px-3 py-2 text-sm text-warm-gray">
              No lists yet
            </p>
          ) : (
            myLists.map((list) => (
              <div key={list.id}>
                {editingListId === list.id ? (
                  <div className="flex items-center gap-1 p-2 bg-cream-dark rounded-lg">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameList(list.id);
                        if (e.key === 'Escape') {
                          setEditingListId(null);
                          setEditingName('');
                        }
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-gold rounded focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameList(list.id)}
                      className="p-1 text-green-600 hover:text-green-700"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setEditingListId(null); setEditingName(''); }}
                      className="p-1 text-warm-gray hover:text-charcoal"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : showDeleteConfirm === list.id ? (
                  <div className="p-2 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-700 mb-2">Delete &quot;{list.name}&quot;?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteList(list.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    selectedListId === list.id
                      ? 'bg-charcoal/5 text-charcoal font-medium'
                      : 'hover:bg-cream-dark'
                  }`}>
                    <button
                      onClick={() => onSelectList(list.id)}
                      className="flex-1 text-left text-sm min-w-0"
                    >
                      <span className="block truncate">{list.name}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingListId(list.id);
                          setEditingName(list.name);
                        }}
                        className="p-1 text-warm-gray hover:text-gold"
                        title="Rename"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(list.id);
                        }}
                        className="p-1 text-warm-gray hover:text-red-500"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Shared with me section */}
        {acceptedShares.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-medium text-warm-gray uppercase tracking-wide block mb-2 px-3">
              Shared with me
            </span>
            <div className="space-y-0.5">
              {acceptedShares.map((share) => (
                <button
                  key={share.id}
                  onClick={() => onSelectList(share.grocery_list_id)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    selectedListId === share.grocery_list_id
                      ? 'bg-charcoal/5 text-charcoal font-medium'
                      : 'hover:bg-cream-dark'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block truncate">{share.grocery_list_name}</span>
                    <span className="text-[10px] text-warm-gray">by {share.owner.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pending invitations */}
        {pendingShares.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-medium text-warm-gray uppercase tracking-wide block mb-2 px-3">
              Pending Invites
            </span>
            <div className="space-y-2">
              {pendingShares.map((share) => (
                <div key={share.id} className="p-2 bg-cream-dark rounded-lg">
                  <p className="text-sm font-medium text-charcoal truncate">{share.grocery_list_name}</p>
                  <p className="text-xs text-warm-gray mb-2">by {share.owner.name}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAcceptShare(share.id)}
                      className="flex-1 px-2 py-1 text-xs bg-gold text-white rounded hover:bg-gold-dark"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onDeclineShare(share.id)}
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
      </div>
    </div>
  );
}
