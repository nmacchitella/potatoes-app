'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { recipeApi } from '@/lib/api';
import { RecipeList } from '@/components/recipes';
import Navbar from '@/components/layout/Navbar';
import type { RecipeSummary, RecipeListParams } from '@/types';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRecipes = async (params?: RecipeListParams) => {
    setLoading(true);
    try {
      const response = await recipeApi.list({
        page: currentPage,
        page_size: 12,
        search: search || undefined,
        ...params,
      });
      setRecipes(response.items);
      setTotalPages(response.total_pages);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [currentPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRecipes();
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <h1 className="text-3xl font-bold">My Recipes</h1>
            <Link href="/recipes/new" className="btn-primary">
              + New Recipe
            </Link>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search recipes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field flex-1"
              />
              <button type="submit" className="btn-secondary">
                Search
              </button>
            </div>
          </form>

          {/* Recipe Grid */}
          <RecipeList
            recipes={recipes}
            loading={loading}
            emptyMessage={search ? "No recipes match your search" : "No recipes yet"}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="flex items-center px-4 text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
