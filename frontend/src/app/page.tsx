'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import Navbar from '@/components/layout/Navbar';

export default function HomePage() {
  const { user, fetchUserProfile } = useStore();

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <h2 className="text-2xl font-semibold mb-4">Welcome, {user?.name || 'User'}!</h2>
            <p className="text-gray-400 mb-6">
              Your Family Kitchen app is ready. Start by setting up your profile and adding recipes.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <a href="/recipes" className="p-4 bg-dark-hover rounded-lg hover:bg-dark-card hover:border-primary/50 border border-transparent transition-colors cursor-pointer block">
                <h3 className="font-medium mb-2">Recipes</h3>
                <p className="text-sm text-gray-400">Create and organize your family recipes</p>
              </a>
              <a href="/feed" className="p-4 bg-dark-hover rounded-lg hover:bg-dark-card hover:border-primary/50 border border-transparent transition-colors cursor-pointer block">
                <h3 className="font-medium mb-2">Feed</h3>
                <p className="text-sm text-gray-400">See recipes from people you follow</p>
              </a>
              <div className="p-4 bg-dark-hover rounded-lg opacity-50">
                <h3 className="font-medium mb-2">Family</h3>
                <p className="text-sm text-gray-400">Coming soon</p>
              </div>
              <div className="p-4 bg-dark-hover rounded-lg opacity-50">
                <h3 className="font-medium mb-2">Meal Planning</h3>
                <p className="text-sm text-gray-400">Coming soon</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>Potatoes - Family Kitchen v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
