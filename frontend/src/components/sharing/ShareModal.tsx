'use client';

import { Modal } from '@/components/ui';
import type { UserSearchResult } from '@/types';

interface ShareUser {
  id: string;
  name: string;
  profile_image_url?: string | null;
}

interface Share {
  id: string;
  user: ShareUser;
  user_id: string;
  permission: 'viewer' | 'editor';
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  shares: Share[];
  loadingShares: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: UserSearchResult[];
  searching: boolean;
  sharingUserId: string | null;
  onShareWithUser: (userId: string, permission: 'viewer' | 'editor') => void;
  onUpdatePermission: (userId: string, permission: 'viewer' | 'editor') => void;
  onRemoveShare: (userId: string) => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  title,
  shares,
  loadingShares,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searching,
  sharingUserId,
  onShareWithUser,
  onUpdatePermission,
  onRemoveShare,
}: ShareModalProps) {
  const handleClose = () => {
    onSearchQueryChange('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="bg-white rounded-xl max-h-[80vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-serif text-lg text-charcoal">{title}</h2>
          <button
            onClick={handleClose}
            className="text-warm-gray hover:text-charcoal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* User Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-charcoal mb-2">
              Add people
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-gold"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-border rounded-lg divide-y divide-border">
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {user.profile_image_url ? (
                        <img
                          src={user.profile_image_url}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center">
                          <span className="text-xs font-medium text-charcoal">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-charcoal">{user.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onShareWithUser(user.id, 'viewer')}
                      disabled={sharingUserId === user.id}
                      className="px-3 py-1.5 text-xs bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
                    >
                      {sharingUserId === user.id ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Shares */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              People with access
            </label>
            {loadingShares ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-warm-gray text-center py-4">
                No one else has access yet
              </p>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border">
                {shares.map(share => (
                  <div key={share.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {share.user.profile_image_url ? (
                        <img
                          src={share.user.profile_image_url}
                          alt={share.user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center">
                          <span className="text-xs font-medium text-charcoal">
                            {share.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-charcoal">{share.user.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={share.permission}
                        onChange={(e) => onUpdatePermission(share.user_id, e.target.value as 'viewer' | 'editor')}
                        className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:border-gold"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={() => onRemoveShare(share.user_id)}
                        className="p-1 text-warm-gray hover:text-red-500"
                        title="Remove access"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleClose}
            className="w-full py-2 bg-charcoal text-white rounded-lg text-sm hover:bg-charcoal/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
