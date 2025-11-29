'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export default function HomePage() {
  const { user, fetchUserProfile, logout } = useStore();

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-text-primary">
            🥔 Potatoes
          </h1>
          <button
            onClick={logout}
            className="btn-secondary"
          >
            Logout
          </button>
        </div>

        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Welcome, {user?.name || 'User'}!</h2>
          <p className="text-gray-400 mb-6">
            Your Family Kitchen app is ready. Start by setting up your profile and adding recipes.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-dark-hover rounded-lg">
              <h3 className="font-medium mb-2">📖 Recipes</h3>
              <p className="text-sm text-gray-400">Create and organize your family recipes</p>
            </div>
            <div className="p-4 bg-dark-hover rounded-lg">
              <h3 className="font-medium mb-2">👨‍👩‍👧‍👦 Family</h3>
              <p className="text-sm text-gray-400">Invite family members to collaborate</p>
            </div>
            <div className="p-4 bg-dark-hover rounded-lg">
              <h3 className="font-medium mb-2">📅 Meal Planning</h3>
              <p className="text-sm text-gray-400">Plan your weekly meals together</p>
            </div>
            <div className="p-4 bg-dark-hover rounded-lg">
              <h3 className="font-medium mb-2">🛒 Shopping List</h3>
              <p className="text-sm text-gray-400">Auto-generate shopping lists from your plan</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Potatoes - Family Kitchen v1.0</p>
        </div>
      </div>
    </div>
  );
}
