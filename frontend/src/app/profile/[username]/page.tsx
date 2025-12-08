'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { socialApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import FollowButton from '@/components/social/FollowButton';
import RecipeCard from '@/components/recipes/RecipeCard';
import type { UserProfilePublic, RecipeSummary } from '@/types';

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const { user: currentUser } = useStore();

  const [profile, setProfile] = useState<UserProfilePublic | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [error, setError] = useState('');

  const isOwnProfile = currentUser?.username === username || currentUser?.id === username;

  // Redirect to /profile if viewing own profile
  useEffect(() => {
    if (isOwnProfile) {
      router.replace('/profile');
    }
  }, [isOwnProfile, router]);

  useEffect(() => {
    if (isOwnProfile) return; // Don't load if redirecting

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
  }, [username, isOwnProfile]);

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

  if (isOwnProfile) {
    return null; // Will redirect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-24 h-24 rounded-full bg-cream-dark" />
                <div className="flex-1">
                  <div className="h-8 bg-cream-dark rounded w-48 mb-2" />
                  <div className="h-4 bg-cream-dark rounded w-32" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg border border-border p-12 text-center">
              <p className="text-warm-gray mb-4">{error || 'User not found'}</p>
              <Link href="/" className="text-gold hover:underline">
                Go back home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canViewRecipes = profile.is_public || profile.follow_status === 'confirmed';

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white rounded-lg border border-border p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="w-24 h-24 rounded-full bg-cream-dark border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-serif text-charcoal">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-charcoal">{profile.name}</h1>
                    {profile.username && (
                      <p className="text-warm-gray">@{profile.username}</p>
                    )}
                  </div>

                  <FollowButton
                    userId={profile.id}
                    initialFollowStatus={profile.follow_status || null}
                    isPublic={profile.is_public}
                    onStatusChange={handleFollowChange}
                  />
                </div>

                {profile.bio && (
                  <p className="text-warm-gray mb-4">{profile.bio}</p>
                )}

                <div className="flex justify-center sm:justify-start gap-6 text-sm">
                  <div>
                    <span className="font-semibold text-charcoal">{recipes.length}</span>
                    <span className="text-warm-gray ml-1">recipes</span>
                  </div>
                  <div>
                    <span className="font-semibold text-charcoal">{profile.follower_count}</span>
                    <span className="text-warm-gray ml-1">followers</span>
                  </div>
                  <div>
                    <span className="font-semibold text-charcoal">{profile.following_count}</span>
                    <span className="text-warm-gray ml-1">following</span>
                  </div>
                </div>

                {!profile.is_public && (
                  <div className="mt-4 flex items-center gap-2 text-sm justify-center sm:justify-start">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Private Account
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recipes */}
          <div>
            <h2 className="text-xl font-semibold text-charcoal mb-4">Recipes</h2>

            {!canViewRecipes ? (
              <div className="bg-white rounded-lg border border-border p-12 text-center">
                <svg className="w-12 h-12 mx-auto text-warm-gray/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-charcoal mb-2">This account is private</p>
                <p className="text-warm-gray text-sm">
                  {profile.follow_status === 'pending'
                    ? 'Your follow request is pending'
                    : 'Follow to see their recipes'}
                </p>
              </div>
            ) : recipesLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-48 bg-cream-dark rounded-lg mb-3" />
                    <div className="h-5 bg-cream-dark rounded w-3/4 mb-2" />
                    <div className="h-4 bg-cream-dark rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : recipes.length === 0 ? (
              <div className="bg-white rounded-lg border border-border p-12 text-center">
                <p className="text-warm-gray">No recipes yet</p>
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
