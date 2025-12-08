'use client';

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { ingredientApi, searchApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { Ingredient, RecipeSummary } from '@/types';

export default function IngredientPage() {
  const params = useParams();
  const ingredientId = params.id as string;

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecipes, setTotalRecipes] = useState(0);

  useEffect(() => {
    loadIngredient();
  }, [ingredientId]);

  useEffect(() => {
    if (ingredient) {
      loadRecipes();
    }
  }, [ingredient, page]);

  const loadIngredient = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ingredientApi.get(ingredientId);
      setIngredient(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Ingredient not found');
      } else {
        setError('Failed to load ingredient');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRecipes = async () => {
    setRecipesLoading(true);
    try {
      const data = await searchApi.getRecipesByIngredient(ingredientId, page, 12);
      setRecipes(data.items);
      setTotalPages(data.total_pages);
      setTotalRecipes(data.total);
    } catch (err) {
      console.error('Failed to load recipes:', err);
    } finally {
      setRecipesLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !ingredient) {
    return (
      <div className="min-h-screen bg-cream has-bottom-nav">
        <Navbar />
        <MobileNavWrapper />
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
            <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-charcoal mb-2">{error || 'Ingredient not found'}</h1>
          <p className="text-warm-gray mb-6">The ingredient you're looking for doesn't exist or isn't available.</p>
          <Link href="/recipes" className="btn-primary">
            Back to Recipes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h1 className="font-serif text-3xl text-charcoal capitalize">{ingredient.name}</h1>
              {ingredient.category && (
                <p className="text-warm-gray capitalize">{ingredient.category}</p>
              )}
            </div>
          </div>
        </div>

        {/* Recipes with this ingredient */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-xl text-charcoal">
              Recipes with {ingredient.name}
            </h2>
            <span className="text-sm text-warm-gray">
              {totalRecipes} recipe{totalRecipes !== 1 ? 's' : ''}
            </span>
          </div>

          {recipesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-border">
              <p className="text-warm-gray">No recipes found with this ingredient.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipes.map(recipe => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="group"
                  >
                    <div className="aspect-[4/3] rounded-lg overflow-hidden mb-3 bg-cream-dark">
                      {recipe.cover_image_url ? (
                        <img
                          src={recipe.cover_image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <h3 className="font-serif text-lg text-charcoal group-hover:text-gold transition-colors mb-1">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-sm text-warm-gray line-clamp-2 mb-2">{recipe.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-warm-gray">
                      <span>by {recipe.author.name}</span>
                      {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                        <>
                          <span className="text-border">|</span>
                          <span>{(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min</span>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-border rounded-lg text-sm text-charcoal hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 text-sm text-warm-gray">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-border rounded-lg text-sm text-charcoal hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
