'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { socialApi, recipeApi, collectionApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import RecipeCard from '@/components/recipes/RecipeCard';
import FollowButton from '@/components/social/FollowButton';
import type { User, UserSearchResult, RecipeSummary, Collection } from '@/types';

type TabType = 'collections' | 'followers' | 'following';

export default function MyProfilePage() {
  const { user: currentUser, fetchUserProfile } = useStore();

  const [activeTab, setActiveTab] = useState<TabType>('collections');
  const [profile, setProfile] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [followers, setFollowers] = useState<UserSearchResult[]>([]);
  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [requests, setRequests] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    if (currentUser) {
      setProfile(currentUser);
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recipesRes, collectionsRes, followersRes, followingRes, requestsRes] = await Promise.all([
        recipeApi.list({ page: 1, page_size: 50 }),
        collectionApi.list(),
        socialApi.getFollowers(),
        socialApi.getFollowing(),
        socialApi.getFollowRequests(),
      ]);
      setRecipes(recipesRes.items);
      setCollections(collectionsRes);
      setFollowers(followersRes);
      setFollowing(followingRes);
      setRequests(requestsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowAction = async (userId: string, action: 'accept' | 'decline') => {
    try {
      if (action === 'accept') {
        await socialApi.acceptFollowRequest(userId);
      } else {
        await socialApi.declineFollowRequest(userId);
      }
      // Reload data
      loadData();
    } catch (err) {
      console.error('Failed to handle follow request:', err);
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      await socialApi.unfollow(userId);
      setFollowing(following.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Failed to unfollow:', err);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="p-8">
          <div className="max-w-4xl mx-auto text-center py-12">
            <p className="text-warm-gray">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'collections', label: 'Collections', count: collections.length },
    { id: 'followers', label: 'Followers', count: followers.length + requests.length },
    { id: 'following', label: 'Following', count: following.length },
  ];

  return (
    <div className="min-h-screen bg-cream has-bottom-nav overflow-x-hidden">
      <Navbar />
      <MobileNavWrapper />
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto w-full">
          {/* Profile Header */}
          <div className="bg-white rounded-lg border border-border p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="w-24 h-24 rounded-full bg-cream-dark border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile?.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-serif text-charcoal">
                    {profile?.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-charcoal">{profile?.name}</h1>
                    {profile?.username && (
                      <p className="text-warm-gray">@{profile.username}</p>
                    )}
                  </div>

                  <Link
                    href="/settings"
                    className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-charcoal hover:bg-cream transition-colors"
                  >
                    Edit Profile
                  </Link>
                </div>

                {profile?.bio && (
                  <p className="text-warm-gray mb-4">{profile.bio}</p>
                )}

                <div className="flex justify-center sm:justify-start gap-6 text-sm">
                  <Link
                    href="/"
                    className="hover:text-gold transition-colors"
                  >
                    <span className="font-semibold text-charcoal">{recipes.length}</span>
                    <span className="text-warm-gray ml-1">recipes</span>
                  </Link>
                  <button
                    onClick={() => setActiveTab('followers')}
                    className="hover:text-gold transition-colors"
                  >
                    <span className="font-semibold text-charcoal">{followers.length}</span>
                    <span className="text-warm-gray ml-1">followers</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('following')}
                    className="hover:text-gold transition-colors"
                  >
                    <span className="font-semibold text-charcoal">{following.length}</span>
                    <span className="text-warm-gray ml-1">following</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-gold'
                    : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-gold/10 text-gold'
                      : 'bg-cream-dark text-warm-gray'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-48 bg-cream-dark rounded-lg mb-3" />
                  <div className="h-5 bg-cream-dark rounded w-3/4 mb-2" />
                  <div className="h-4 bg-cream-dark rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Collections Tab */}
              {activeTab === 'collections' && (
                collections.length === 0 ? (
                  <div className="bg-white rounded-lg border border-border p-12 text-center">
                    <p className="text-warm-gray mb-4">You haven't created any collections yet</p>
                    <Link
                      href="/collections/new"
                      className="inline-block px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
                    >
                      Create Your First Collection
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {collections.map(collection => (
                      <Link
                        key={collection.id}
                        href={`/collections/${collection.id}`}
                        className="bg-white rounded-lg border border-border hover:border-gold/50 transition-colors overflow-hidden group"
                      >
                        <div className="h-32 bg-cream-dark overflow-hidden">
                          {collection.cover_image_url ? (
                            <img
                              src={collection.cover_image_url}
                              alt={collection.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-warm-gray/50">
                              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-medium text-charcoal group-hover:text-gold transition-colors">
                            {collection.name}
                          </h3>
                          {collection.description && (
                            <p className="text-sm text-warm-gray mt-1 line-clamp-2">{collection.description}</p>
                          )}
                          <p className="text-xs text-warm-gray mt-2">
                            {collection.recipe_count || 0} recipes
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              )}

              {/* Followers Tab */}
              {activeTab === 'followers' && (
                requests.length === 0 && followers.length === 0 ? (
                  <div className="bg-white rounded-lg border border-border p-12 text-center">
                    <p className="text-warm-gray">No followers yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Pending Requests Section */}
                    {requests.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-charcoal mb-3">
                          Pending Requests ({requests.length})
                        </h3>
                        <div className="bg-white rounded-lg border border-gold/30 divide-y divide-border">
                          {requests.map(user => (
                            <div key={user.id} className="p-4 flex items-center justify-between bg-gold/5">
                              <Link
                                href={`/profile/${user.username || user.id}`}
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                              >
                                <div className="w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center overflow-hidden">
                                  {user.profile_image_url ? (
                                    <img src={user.profile_image_url} alt={user.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-lg font-serif text-charcoal">{user.name.charAt(0)}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-charcoal">{user.name}</p>
                                  {user.username && <p className="text-sm text-warm-gray">@{user.username}</p>}
                                </div>
                              </Link>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleFollowAction(user.id, 'accept')}
                                  className="px-3 py-1.5 text-sm bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleFollowAction(user.id, 'decline')}
                                  className="px-3 py-1.5 text-sm border border-border rounded-lg text-warm-gray hover:text-charcoal transition-colors"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confirmed Followers */}
                    {followers.length > 0 && (
                      <div>
                        {requests.length > 0 && (
                          <h3 className="text-sm font-medium text-charcoal mb-3">
                            Followers ({followers.length})
                          </h3>
                        )}
                        <div className="bg-white rounded-lg border border-border divide-y divide-border">
                          {followers.map(user => (
                            <div key={user.id} className="p-4 flex items-center justify-between">
                              <Link
                                href={`/profile/${user.username || user.id}`}
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                              >
                                <div className="w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center overflow-hidden">
                                  {user.profile_image_url ? (
                                    <img src={user.profile_image_url} alt={user.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-lg font-serif text-charcoal">{user.name.charAt(0)}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-charcoal">{user.name}</p>
                                  {user.username && <p className="text-sm text-warm-gray">@{user.username}</p>}
                                </div>
                              </Link>
                              <FollowButton
                                userId={user.id}
                                initialFollowStatus={user.follow_status || null}
                                isPublic={user.is_public}
                                size="sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Following Tab */}
              {activeTab === 'following' && (
                following.length === 0 ? (
                  <div className="bg-white rounded-lg border border-border p-12 text-center">
                    <p className="text-warm-gray">You're not following anyone yet</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-border divide-y divide-border">
                    {following.map(user => (
                      <div key={user.id} className="p-4 flex items-center justify-between">
                        <Link
                          href={`/profile/${user.username || user.id}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          <div className="w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center overflow-hidden">
                            {user.profile_image_url ? (
                              <img src={user.profile_image_url} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg font-serif text-charcoal">{user.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-charcoal">{user.name}</p>
                            {user.username && <p className="text-sm text-warm-gray">@{user.username}</p>}
                          </div>
                        </Link>
                        <button
                          onClick={() => handleUnfollow(user.id)}
                          className="px-3 py-1.5 text-sm border border-border rounded-lg text-warm-gray hover:text-charcoal hover:border-charcoal transition-colors"
                        >
                          Unfollow
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
