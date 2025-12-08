'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, getRefreshToken } from '@/lib/auth-storage';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has tokens (logged in)
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (accessToken || refreshToken) {
      // User is logged in, redirect to recipes
      router.replace('/recipes');
    } else {
      // User is not logged in, redirect to login
      router.replace('/login');
    }
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="text-text-primary text-xl">Loading...</div>
    </div>
  );
}
