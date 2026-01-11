'use client';

import { useRef, useEffect } from 'react';
import type { Collection, SharedCollection } from '@/types';

interface CollectionSidebarProps {
  collections: Collection[];
  sharedCollections: SharedCollection[];
  selectedCollection: string | null;
  loadingCollections: boolean;
  isManageMode: boolean;
  onToggleManageMode: () => void;
  onCollectionClick: (collectionId: string | null) => void;
  // Create collection
  isCreatingCollection: boolean;
  newCollectionName: string;
  savingCollection: boolean;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onNewCollectionNameChange: (name: string) => void;
  onCreateCollection: () => void;
  // Edit collection
  editingCollectionId: string | null;
  editingCollectionName: string;
  onStartEdit: (collection: Collection) => void;
  onCancelEdit: () => void;
  onEditNameChange: (name: string) => void;
  onUpdateCollection: (collectionId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onTogglePrivacy: (collection: Collection) => void;
  // Manage recipes
  onManageRecipes: (collectionId: string) => void;
}

export default function CollectionSidebar({
  collections,
  sharedCollections,
  selectedCollection,
  loadingCollections,
  isManageMode,
  onToggleManageMode,
  onCollectionClick,
  isCreatingCollection,
  newCollectionName,
  savingCollection,
  onStartCreate,
  onCancelCreate,
  onNewCollectionNameChange,
  onCreateCollection,
  editingCollectionId,
  editingCollectionName,
  onStartEdit,
  onCancelEdit,
  onEditNameChange,
  onUpdateCollection,
  onDeleteCollection,
  onTogglePrivacy,
  onManageRecipes,
}: CollectionSidebarProps) {
  const newCollectionInputRef = useRef<HTMLInputElement>(null);
  const editCollectionInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <nav className="flex flex-col max-h-[calc(100vh-10rem)]">
      {/* Header section */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-warm-gray uppercase tracking-wide">Collections</span>
          {collections.length > 0 && (
            <button
              onClick={onToggleManageMode}
              className={`text-xs transition-colors ${isManageMode ? 'text-gold font-medium' : 'text-warm-gray hover:text-gold'}`}
            >
              {isManageMode ? 'Done' : 'Manage'}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable collections list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
        {loadingCollections ? (
          <div className="px-3 py-2">
            <div className="animate-pulse h-4 bg-cream-dark rounded w-3/4" />
          </div>
        ) : (
          <>
            {/* All Recipes option */}
            {!isManageMode && (
              <button
                onClick={() => onCollectionClick(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedCollection
                    ? 'bg-charcoal/5 text-charcoal font-medium'
                    : 'text-charcoal hover:bg-cream-dark'
                }`}
              >
                All
              </button>
            )}

            {/* User collections */}
            {collections.map(collection => (
          <div key={collection.id} className="group relative">
            {editingCollectionId === collection.id ? (
              <div className="flex items-center gap-1 px-2">
                <input
                  ref={editCollectionInputRef}
                  type="text"
                  value={editingCollectionName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onUpdateCollection(collection.id);
                    if (e.key === 'Escape') onCancelEdit();
                  }}
                  className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
                  disabled={savingCollection}
                />
                <button
                  onClick={() => onUpdateCollection(collection.id)}
                  disabled={savingCollection}
                  className="p-1 text-green-600 hover:text-green-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={onCancelEdit}
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
                    onClick={() => onManageRecipes(collection.id)}
                    className="block w-full text-left truncate text-charcoal hover:text-gold transition-colors"
                  >
                    {collection.name}
                  </button>
                  <button
                    onClick={() => onTogglePrivacy(collection)}
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
                      onClick={() => onStartEdit(collection)}
                      className="p-1 text-warm-gray hover:text-gold"
                      title="Rename"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteCollection(collection.id)}
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
                onClick={() => onCollectionClick(collection.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCollection === collection.id
                    ? 'bg-charcoal/5 text-charcoal font-medium'
                    : 'text-charcoal hover:bg-cream-dark'
                }`}
              >
                <span className="truncate">{collection.name}</span>
              </button>
            )}
          </div>
        ))}

            {/* Shared collections - integrated into main list */}
            {sharedCollections.map(collection => (
              <button
                key={collection.id}
                onClick={() => onCollectionClick(collection.id)}
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
                </span>
                <span className="text-[10px] text-warm-gray block">by {collection.owner.name}</span>
              </button>
            ))}
          </>
        )}

        {/* New Collection Input */}
        {isCreatingCollection ? (
          <div className="flex items-center gap-1 px-2">
            <input
              ref={newCollectionInputRef}
              type="text"
              value={newCollectionName}
              onChange={(e) => onNewCollectionNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreateCollection();
                if (e.key === 'Escape') onCancelCreate();
              }}
              placeholder="Collection name..."
              className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
              disabled={savingCollection}
            />
            <button
              onClick={onCreateCollection}
              disabled={savingCollection || !newCollectionName.trim()}
              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={onCancelCreate}
              className="p-1 text-warm-gray hover:text-charcoal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={onStartCreate}
            className="block w-full text-left px-3 py-2 text-sm text-gold hover:text-gold-dark"
          >
            + New Collection
          </button>
        )}

      </div>
    </nav>
  );
}
