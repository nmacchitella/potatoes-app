'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { socialApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import Navbar from '@/components/layout/Navbar';
import FollowButton from '@/components/social/FollowButton';
import RecipeCard from '@/components/recipes/RecipeCard';
import type { UserProfilePublic, RecipeSummary } from '@/types';

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: currentUser } = useStore();

  const [profile, setProfile] = useState<UserProfilePublic | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [error, setError] = useState('');

  const isOwnProfile = currentUser?.username === username || currentUser?.id === username;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await socialApi.getUserProfile(username);
        setProfile(profileData);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'User not found');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [username]);

  useEffect(() => {
    const loadRecipes = async () => {
      if (!profile) return;

      try {
        const response = await socialApi.getUserRecipes(username);
        setRecipes(response.items);
      } catch (err) {
        console.error('Failed to load recipes:', err);
      } finally {
        setRecipesLoading(false);
      }
    };

    if (profile) {
      loadRecipes();
    }
  }, [profile, username]);

  const handleFollowChange = (newStatus: 'pending' | 'confirmed' | null) => {
    if (profile) {
      setProfile({
        ...profile,
        follow_status: newStatus,
        is_followed_by_me: newStatus !== null,
        follower_count: newStatus === 'confirmed'
          ? profile.follower_count + 1
          : newStatus === null
            ? Math.max(0, profile.follower_count - 1)
            : profile.follower_count,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 rounded-full bg-dark-hover" />
              <div className="flex-1">
                <div className="h-8 bg-dark-hover rounded w-48 mb-2" />
                <div className="h-4 bg-dark-hover rounded w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-dark-bg p-8">
        <div className="max-w-4xl mx-auto">
          <div className="card text-center py-12">
            <p className="text-gray-400 mb-4">{error || 'User not found'}</p>
            <Link href="/" className="text-primary hover:underline">
              Go back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canViewRecipes = profile.is_public || profile.follow_status === 'confirmed' || isOwnProfile;

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
        <div className="card mb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-dark-hover flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile.profile_image_url ? (
                <img
                  src={profile.profile_image_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">{profile.name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold">{profile.name}</h1>
                  {profile.username && (
                    <p className="text-gray-400">@{profile.username}</p>
                  )}
                </div>

                {!isOwnProfile && (
                  <FollowButton
                    userId={profile.id}
                    initialFollowStatus={profile.follow_status || null}
                    isPublic={profile.is_public}
                    onStatusChange={handleFollowChange}
                  />
                )}

                {isOwnProfile && (
                  <Link href="/settings" className="btn-secondary">
                    Edit Profile
                  </Link>
                )}
              </div>

              {profile.bio && (
                <p className="text-gray-300 mb-4">{profile.bio}</p>
              )}

              <div className="flex justify-center sm:justify-start gap-6 text-sm">
                <div>
                  <span className="font-semibold">{recipes.length}</span>
                  <span className="text-gray-400 ml-1">recipes</span>
                </div>
                <div>
                  <span className="font-semibold">{profile.follower_count}</span>
                  <span className="text-gray-400 ml-1">followers</span>
                </div>
                <div>
                  <span className="font-semibold">{profile.following_count}</span>
                  <span className="text-gray-400 ml-1">following</span>
                </div>
              </div>

              {!profile.is_public && !isOwnProfile && (
                <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm justify-center sm:justify-start">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Private account</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recipes */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recipes</h2>

          {!canViewRecipes ? (
            <div className="card text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-gray-400 mb-2">This account is private</p>
              <p className="text-gray-500 text-sm">Follow to see their recipes</p>
            </div>
          ) : recipesLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-48 bg-dark-hover rounded-lg mb-3" />
                  <div className="h-5 bg-dark-hover rounded w-3/4 mb-2" />
                  <div className="h-4 bg-dark-hover rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400">No recipes yet</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
