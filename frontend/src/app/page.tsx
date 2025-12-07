'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessToken, getRefreshToken } from '@/lib/auth-storage';

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user has tokens (logged in)
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (accessToken || refreshToken) {
      // User is logged in, redirect to recipes
      router.replace('/recipes');
    } else {
      // User is not logged in, show landing page
      setChecking(false);
    }
  }, [router]);

  // Show nothing while checking auth state
  if (checking) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-text-primary text-xl">Loading...</div>
      </div>
    );
  }

  // Landing page for logged-out users
  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-4">
      <h1 className="text-6xl md:text-8xl font-bold text-text-primary mb-4 tracking-tight">
        Potatoes
      </h1>
      <p className="text-xl md:text-2xl text-gray-400 mb-12 font-light">
        Your family kitchen, organized.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-8 py-3 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
