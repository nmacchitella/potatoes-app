'use client';

import { useState } from 'react';
import type { GroceryListSummary, SharedGroceryListAccess } from '@/types';

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

  const acceptedShares = sharedWithMe.filter(s => s.status === 'accepted');
  const pendingShares = sharedWithMe.filter(s => s.status === 'pending');

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      await onCreateList(newListName.trim());
      setNewListName('');
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  const handleRenameList = async (listId: string) => {
    if (!editingName.trim()) return;
    try {
      await onRenameList(listId, editingName.trim());
      setEditingListId(null);
      setEditingName('');
    } catch (err) {
      console.error('Failed to rename list:', err);
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      await onDeleteList(listId);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete list:', err);
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
    <div className="w-64 bg-white border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-charcoal">Grocery Lists</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 text-warm-gray hover:text-gold transition-colors"
            title="Create new list"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Create new list form */}
        {isCreating && (
          <form onSubmit={handleCreateList} className="mt-3">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 text-sm bg-gold text-white rounded-lg hover:bg-gold/90"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewListName(''); }}
                className="px-3 py-1.5 text-sm text-warm-gray hover:text-charcoal"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto">
        {/* My Lists */}
        <div className="p-2">
          <h3 className="px-2 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
            My Lists
          </h3>
          {myLists.length === 0 ? (
            <p className="px-2 py-3 text-sm text-warm-gray">
              No lists yet. Create one to get started.
            </p>
          ) : (
            <ul className="space-y-1">
              {myLists.map((list) => (
                <li key={list.id}>
                  {editingListId === list.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleRenameList(list.id); }}
                      className="flex items-center gap-1 px-2"
                    >
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-gold/50"
                        autoFocus
                      />
                      <button type="submit" className="p-1 text-green-600 hover:text-green-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingListId(null); setEditingName(''); }}
                        className="p-1 text-warm-gray hover:text-charcoal"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </form>
                  ) : showDeleteConfirm === list.id ? (
                    <div className="px-2 py-2 bg-red-50 rounded-lg">
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
                    <button
                      onClick={() => onSelectList(list.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors group ${
                        selectedListId === list.id
                          ? 'bg-gold/10 text-charcoal'
                          : 'hover:bg-cream text-charcoal'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">{list.name}</span>
                        <span className="text-xs text-warm-gray">{list.item_count} items</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingListId(list.id);
                            setEditingName(list.name);
                          }}
                          className="p-1 text-warm-gray hover:text-charcoal"
                          title="Rename"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending invitations */}
        {pendingShares.length > 0 && (
          <div className="p-2 border-t border-border">
            <h3 className="px-2 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
              Pending Invitations
            </h3>
            <ul className="space-y-1">
              {pendingShares.map((share) => (
                <li key={share.id} className="px-3 py-2 bg-gold/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-medium text-charcoal truncate">
                        {share.grocery_list_name}
                      </span>
                      <span className="text-xs text-warm-gray">
                        from {share.owner.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onAcceptShare(share.id)}
                      className="flex-1 px-2 py-1 text-xs bg-gold text-white rounded hover:bg-gold/90"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onDeclineShare(share.id)}
                      className="px-2 py-1 text-xs text-warm-gray hover:text-red-500"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Shared with me */}
        {acceptedShares.length > 0 && (
          <div className="p-2 border-t border-border">
            <h3 className="px-2 py-1 text-xs font-medium text-warm-gray uppercase tracking-wider">
              Shared with Me
            </h3>
            <ul className="space-y-1">
              {acceptedShares.map((share) => (
                <li key={share.id}>
                  <button
                    onClick={() => onSelectList(share.grocery_list_id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors group ${
                      selectedListId === share.grocery_list_id
                        ? 'bg-gold/10 text-charcoal'
                        : 'hover:bg-cream text-charcoal'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {share.grocery_list_name}
                      </span>
                      <span className="text-xs text-warm-gray">
                        by {share.owner.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLeaveSharedList(share.id);
                      }}
                      className="p-1 text-warm-gray hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Leave list"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
