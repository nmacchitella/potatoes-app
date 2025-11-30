'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import type { RecipeWithScale } from '@/types';

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, fetchUserProfile } = useStore();
  const [recipe, setRecipe] = useState<RecipeWithScale | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const recipeId = params.id as string;

  // Ensure user is loaded for ownership check
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    const fetchRecipe = async () => {
      setLoading(true);
      try {
        const data = await recipeApi.get(recipeId, scale !== 1 ? scale : undefined);
        setRecipe(data);
      } catch (error) {
        console.error('Failed to fetch recipe:', error);
        router.push('/recipes');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [recipeId, scale]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    setDeleting(true);
    try {
      await recipeApi.delete(recipeId);
      router.push('/recipes');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      setDeleting(false);
    }
  };

  const formatQuantity = (qty: number | undefined, qtyMax: number | undefined) => {
    if (!qty) return '';
    const formatted = qty % 1 === 0 ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');
    if (qtyMax) {
      const maxFormatted = qtyMax % 1 === 0 ? qtyMax.toString() : qtyMax.toFixed(2).replace(/\.?0+$/, '');
      return `${formatted}-${maxFormatted}`;
    }
    return formatted;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-dark-hover rounded w-1/3 mb-4" />
            <div className="aspect-video bg-dark-hover rounded-lg mb-8" />
            <div className="h-6 bg-dark-hover rounded w-full mb-2" />
            <div className="h-6 bg-dark-hover rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return null;
  }

  const isOwner = user?.id === recipe.author_id;
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb & Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <Link href="/recipes" className="text-gray-400 hover:text-primary text-sm">
            &larr; Back to Recipes
          </Link>
          {isOwner && (
            <div className="flex gap-2">
              <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">
                Edit
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-secondary text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="card mb-8">
          {recipe.cover_image_url && (
            <div className="aspect-video rounded-lg overflow-hidden mb-6 -mx-6 -mt-6">
              <img
                src={recipe.cover_image_url}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <h1 className="text-3xl font-bold mb-4">{recipe.title}</h1>

          {recipe.description && (
            <p className="text-gray-400 mb-6">{recipe.description}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm">
            {totalTime > 0 && (
              <div className="flex items-center gap-2 bg-dark-hover px-3 py-2 rounded-lg">
                <span>⏱️</span>
                <span>{totalTime} min total</span>
              </div>
            )}
            {recipe.prep_time_minutes && (
              <div className="flex items-center gap-2 bg-dark-hover px-3 py-2 rounded-lg">
                <span>🔪</span>
                <span>{recipe.prep_time_minutes} min prep</span>
              </div>
            )}
            {recipe.cook_time_minutes && (
              <div className="flex items-center gap-2 bg-dark-hover px-3 py-2 rounded-lg">
                <span>🍳</span>
                <span>{recipe.cook_time_minutes} min cook</span>
              </div>
            )}
            {recipe.difficulty && (
              <div className={`flex items-center gap-2 bg-dark-hover px-3 py-2 rounded-lg capitalize ${
                recipe.difficulty === 'easy' ? 'text-green-400' :
                recipe.difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {recipe.difficulty}
              </div>
            )}
          </div>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {recipe.tags.map(tag => (
                <span key={tag.id} className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Servings Scaler */}
        <div className="card mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Servings</h3>
              <p className="text-gray-400 text-sm">
                {recipe.scaled_yield_quantity} {recipe.yield_unit}
                {scale !== 1 && (
                  <span className="text-primary ml-2">(scaled {scale}x)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(s => Math.max(0.5, s - 0.5))}
                className="w-8 h-8 rounded bg-dark-hover hover:bg-dark-card flex items-center justify-center"
              >
                -
              </button>
              <span className="w-12 text-center">{scale}x</span>
              <button
                onClick={() => setScale(s => s + 0.5)}
                className="w-8 h-8 rounded bg-dark-hover hover:bg-dark-card flex items-center justify-center"
              >
                +
              </button>
              {scale !== 1 && (
                <button
                  onClick={() => setScale(1)}
                  className="ml-2 text-sm text-gray-400 hover:text-primary"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Ingredients */}
          <div className="md:col-span-1">
            <div className="card sticky top-8">
              <h2 className="text-xl font-semibold mb-4">Ingredients</h2>
              <ul className="space-y-3">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} className="flex gap-2">
                    <span className="text-primary font-medium min-w-[60px]">
                      {formatQuantity(ing.quantity, ing.quantity_max)}
                      {ing.unit && ` ${ing.unit}`}
                    </span>
                    <span className={ing.is_optional ? 'text-gray-400' : ''}>
                      {ing.name}
                      {ing.preparation && <span className="text-gray-500">, {ing.preparation}</span>}
                      {ing.is_optional && <span className="text-gray-500 text-sm"> (optional)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Instructions */}
          <div className="md:col-span-2">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Instructions</h2>
              <ol className="space-y-6">
                {recipe.instructions.map((inst) => (
                  <li key={inst.id} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center">
                      {inst.step_number}
                    </span>
                    <div className="pt-1">
                      <p className="text-gray-200">{inst.instruction_text}</p>
                      {inst.duration_minutes && (
                        <span className="text-sm text-gray-500 mt-1 block">
                          ⏱️ {inst.duration_minutes} min
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Source */}
        {(recipe.source_url || recipe.source_name) && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Source: {recipe.source_url ? (
              <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {recipe.source_name || recipe.source_url}
              </a>
            ) : recipe.source_name}
          </div>
        )}
      </div>
    </div>
  );
}
