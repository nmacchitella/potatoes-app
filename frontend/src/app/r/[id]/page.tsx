'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi } from '@/lib/api';
import { formatIngredient } from '@/lib/constants';
import { useStore } from '@/store/useStore';
import { YouTubeEmbed, isYouTubeUrl } from '@/components/recipes';
import type { RecipeWithScale } from '@/types';

export default function PublicRecipePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useStore();
  const [recipe, setRecipe] = useState<RecipeWithScale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const recipeId = params.id as string;

  useEffect(() => {
    const fetchRecipe = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await recipeApi.get(recipeId, scale !== 1 ? scale : undefined);
        setRecipe(data);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Recipe not found or is private');
        } else {
          setError('Failed to load recipe');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [recipeId, scale]);

  const handleAuthAction = (action: string) => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      // Redirect to full recipe page if logged in
      router.push(`/recipes/${recipeId}`);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;

    // Only use native share on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title: recipe?.title, url });
      } catch {
        // User cancelled or error - fall through to copy
      }
    } else {
      await navigator.clipboard.writeText(url);
      setToastMessage('Link copied!');
      setTimeout(() => setToastMessage(''), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <PublicNavbar />
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-6 bg-cream-dark rounded w-1/4 mb-4" />
            <div className="h-48 bg-cream-dark rounded-lg mb-4" />
            <div className="h-4 bg-cream-dark rounded w-full mb-2" />
            <div className="h-4 bg-cream-dark rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-cream">
        <PublicNavbar />
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
            <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-charcoal mb-2">{error || 'Recipe not available'}</h1>
          <p className="text-warm-gray mb-6">This recipe may be private or doesn't exist.</p>
          <Link href="/auth/login" className="btn-primary">
            Sign in to view more recipes
          </Link>
        </div>
      </div>
    );
  }

  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div className="min-h-screen bg-cream">
      <PublicNavbar />

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAuthModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-warm-gray hover:text-charcoal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl text-charcoal mb-2">Save this recipe</h2>
              <p className="text-warm-gray text-sm">
                Create a free account to save recipes, create collections, and more.
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href={`/auth/login?returnUrl=/recipes/${recipeId}`}
                className="block w-full bg-gold hover:bg-gold-dark text-white text-center font-medium py-3 rounded-full transition-colors"
              >
                Sign in or create account
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-charcoal text-white px-3 py-1.5 rounded text-sm shadow-lg z-50">
          {toastMessage}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1">
            {/* Cover Image / YouTube Embed */}
            {recipe.source_url && isYouTubeUrl(recipe.source_url) ? (
              <div className="mb-4">
                <YouTubeEmbed
                  sourceUrl={recipe.source_url}
                  thumbnailUrl={recipe.cover_image_url}
                  title={recipe.title}
                  videoStartSeconds={recipe.video_start_seconds}
                />
              </div>
            ) : recipe.cover_image_url ? (
              <div className="aspect-[4/3] rounded-lg overflow-hidden mb-4">
                <img src={recipe.cover_image_url} alt={recipe.title} className="w-full h-full object-cover" />
              </div>
            ) : null}

            {/* Title */}
            <h1 className="font-serif text-2xl text-charcoal mb-1">{recipe.title}</h1>

            {/* Author */}
            <p className="text-xs text-warm-gray mb-3">
              by {recipe.author.name}
            </p>

            {/* Source */}
            {(recipe.source_url || recipe.source_name) && (
              <p className="text-xs text-warm-gray mb-3">
                {recipe.source_url ? (
                  <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                    {recipe.source_name || recipe.source_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </a>
                ) : recipe.source_name}
              </p>
            )}

            {/* Description */}
            {recipe.description && (
              <p className="text-warm-gray text-sm mb-3 leading-relaxed">{recipe.description}</p>
            )}

            {/* Tags */}
            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {recipe.tags.map(tag => (
                  <span key={tag.id} className="bg-gold/15 text-gold-dark px-2 py-0.5 rounded text-xs">{tag.name}</span>
                ))}
              </div>
            )}

            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-warm-gray mb-4">
              {totalTime > 0 && <span>{totalTime} min</span>}
              {totalTime > 0 && recipe.difficulty && <span>·</span>}
              {recipe.difficulty && (
                <span className={`capitalize ${recipe.difficulty === 'easy' ? 'text-green-600' : recipe.difficulty === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                  {recipe.difficulty}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <button
                onClick={() => handleAuthAction('save')}
                className="flex items-center gap-1.5 text-xs text-warm-gray hover:text-gold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Collection
              </button>
              <button onClick={handleShare} className="flex items-center gap-1.5 text-xs text-warm-gray hover:text-gold transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ingredients */}
            <div className="bg-white rounded-lg border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl text-charcoal">Ingredients</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-warm-gray">{recipe.scaled_yield_quantity} {recipe.yield_unit}</span>
                  <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="w-5 h-5 rounded bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal text-xs transition-colors">−</button>
                    <span className="w-6 text-center text-xs text-charcoal">{scale}x</span>
                    <button onClick={() => setScale(s => s + 0.5)} className="w-5 h-5 rounded bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal text-xs transition-colors">+</button>
                    {scale !== 1 && <button onClick={() => setScale(1)} className="text-xs text-warm-gray hover:text-gold ml-1">reset</button>}
                  </div>
                </div>
              </div>

              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 pl-4">
                {recipe.ingredients.map(ing => (
                  <li key={ing.id} className="text-xs text-charcoal leading-relaxed list-disc marker:text-gold">
                    {formatIngredient(ing)}
                    {ing.is_optional && <span className="text-warm-gray"> (optional)</span>}
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-lg border border-border p-5">
              <h2 className="font-serif text-xl text-charcoal mb-4">Instructions</h2>

              <ol className="space-y-4">
                {recipe.instructions.map(inst => (
                  <li key={inst.id} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold text-white text-xs font-medium flex items-center justify-center">{inst.step_number}</span>
                    <div className="pt-0.5">
                      <p className="text-charcoal text-sm leading-relaxed">{inst.instruction_text}</p>
                      {inst.duration_minutes && <span className="text-xs text-warm-gray mt-0.5 block">{inst.duration_minutes} min</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Sign Up CTA Banner */}
        {!user && (
          <div className="mt-12 bg-gradient-to-r from-gold/10 to-gold/5 rounded-xl p-6 text-center">
            <h3 className="font-serif text-xl text-charcoal mb-2">Love this recipe?</h3>
            <p className="text-warm-gray text-sm mb-4">
              Sign in to save recipes, build collections, and discover more dishes.
            </p>
            <Link
              href={`/auth/login?returnUrl=/recipes/${recipeId}`}
              className="inline-block bg-gold hover:bg-gold-dark text-white font-medium px-6 py-2 rounded-full text-sm transition-colors"
            >
              Sign in or create account
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

// Simplified public navbar
function PublicNavbar() {
  const { user } = useStore();

  return (
    <nav className="bg-cream border-b border-border sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-serif text-2xl text-charcoal hover:text-gold transition-colors">
            Potatoes
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/" className="text-sm text-charcoal hover:text-gold transition-colors">
                My Recipes
              </Link>
            ) : (
              <Link href="/auth/login" className="btn-primary text-sm py-2 px-4">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
