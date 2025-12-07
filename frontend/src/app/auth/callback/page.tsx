'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { authApi } from '@/lib/api';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, setUser } = useStore();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const refreshToken = searchParams.get('refresh_token');

      if (!token || !refreshToken) {
        console.error('No tokens received from OAuth callback');
        router.push('/login?error=oauth_failed');
        return;
      }

      try {
        // Set both tokens
        setTokens(token, refreshToken);

        // Get user info
        const user = await authApi.getCurrentUser();
        setUser(user);

        // Redirect to recipes page
        router.push('/recipes');
      } catch (error) {
        console.error('Error during OAuth callback:', error);
        router.push('/login?error=oauth_failed');
      }
    };

    handleCallback();
  }, [searchParams, router, setTokens, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="text-center">
        <div className="text-white text-xl mb-4">Completing sign in...</div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
