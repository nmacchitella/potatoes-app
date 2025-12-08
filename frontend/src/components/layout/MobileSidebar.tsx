'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { collectionApi } from '@/lib/api';
import type { Collection, SharedCollection } from '@/types';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useStore();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [sharedCollections, setSharedCollections] = useState<SharedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);

  const selectedCollection = searchParams.get('collection');

  // Load collections on mount
  useEffect(() => {
    if (isOpen && user) {
      loadCollections();
    }
  }, [isOpen, user]);

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
      ? `/recipes?collection=${collectionId}`
      : '/recipes';
    router.push(url);
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    router.push('/login');
  };

  const handleNavClick = (href: string) => {
    router.push(href);
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
              href="/recipes"
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
              onClick={() => handleNavClick(`/profile/${user?.username || user?.id}`)}
              className="flex items-center gap-3 w-full text-left"
            >
              <div className="w-12 h-12 rounded-full bg-cream-dark border border-border flex items-center justify-center overflow-hidden">
                {user?.profile_image_url ? (
                  <img
                    src={user.profile_image_url}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-serif text-charcoal">
                    {user?.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-charcoal truncate">{user?.name}</p>
                <p className="text-sm text-warm-gray truncate">
                  {user?.username ? `@${user.username}` : 'View profile'}
                </p>
              </div>
              <svg className="w-5 h-5 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Quick Links */}
            <div className="p-4 border-b border-border">
              <button
                onClick={() => handleCollectionClick(null)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  pathname === '/recipes' && !selectedCollection
                    ? 'bg-gold/10 text-gold-dark font-medium'
                    : 'text-charcoal hover:bg-cream-dark'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>All Recipes</span>
              </button>
            </div>

            {/* Collections */}
            <div className="p-4">
              <button
                onClick={() => setCollectionsExpanded(!collectionsExpanded)}
                className="flex items-center justify-between w-full mb-2"
              >
                <span className="text-xs font-medium text-warm-gray uppercase tracking-wide">
                  Collections
                </span>
                <svg
                  className={`w-4 h-4 text-warm-gray transition-transform ${collectionsExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {collectionsExpanded && (
                <nav className="space-y-1">
                  {loading ? (
                    <div className="py-4 text-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent mx-auto" />
                    </div>
                  ) : collections.length === 0 ? (
                    <p className="text-sm text-warm-gray py-2 px-3">No collections yet</p>
                  ) : (
                    collections.map(collection => (
                      <button
                        key={collection.id}
                        onClick={() => handleCollectionClick(collection.id)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                          selectedCollection === collection.id
                            ? 'bg-gold/10 text-gold-dark font-medium'
                            : 'text-charcoal hover:bg-cream-dark'
                        }`}
                      >
                        <span className="truncate">{collection.name}</span>
                        <span className="text-xs text-warm-gray ml-2">{collection.recipe_count}</span>
                      </button>
                    ))
                  )}
                </nav>
              )}

              {/* Shared with me */}
              {sharedCollections.length > 0 && (
                <div className="mt-6">
                  <span className="text-xs font-medium text-warm-gray uppercase tracking-wide block mb-2">
                    Shared with me
                  </span>
                  <nav className="space-y-1">
                    {sharedCollections.map(collection => (
                      <button
                        key={collection.id}
                        onClick={() => handleCollectionClick(collection.id)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                          selectedCollection === collection.id
                            ? 'bg-gold/10 text-gold-dark font-medium'
                            : 'text-charcoal hover:bg-cream-dark'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="truncate block">{collection.name}</span>
                          <span className="text-[10px] text-warm-gray">by {collection.owner.name}</span>
                        </div>
                        <span className="text-xs text-warm-gray ml-2">{collection.recipe_count}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 space-y-1">
            <button
              onClick={() => handleNavClick('/settings')}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-charcoal hover:bg-cream-dark transition-colors text-left"
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
