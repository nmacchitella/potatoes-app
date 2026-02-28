'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { authApi } from '@/lib/api';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, setUser } = useStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Support both new code-based flow and legacy token flow for backwards compatibility
      const code = searchParams.get('code');
      const legacyToken = searchParams.get('token');
      const legacyRefreshToken = searchParams.get('refresh_token');

      // Remove sensitive tokens from the URL to prevent leaking via
      // browser history, referrer headers, or shoulder surfing.
      // Note: This does not affect Next.js searchParams since they were
      // already read synchronously above.
      if (code || legacyToken) {
        window.history.replaceState({}, '', '/auth/callback');
      }

      try {
        let accessToken: string;
        let refreshToken: string;

        if (code) {
          // New secure flow: exchange code for tokens via POST
          const tokens = await authApi.exchangeOAuthCode(code);
          accessToken = tokens.access_token;
          refreshToken = tokens.refresh_token;
        } else if (legacyToken && legacyRefreshToken) {
          // Legacy flow (for backwards compatibility during transition)
          accessToken = legacyToken;
          refreshToken = legacyRefreshToken;
        } else {
          setError('Authentication failed. Please try again.');
          setTimeout(() => router.push('/auth/login?error=oauth_failed'), 2000);
          return;
        }

        // Set both tokens
        setTokens(accessToken, refreshToken);

        // Get user info
        const user = await authApi.getCurrentUser();
        setUser(user);

        // Redirect to the originally requested page, or home
        const returnUrl = sessionStorage.getItem('authReturnUrl') || '/';
        sessionStorage.removeItem('authReturnUrl');
        router.push(returnUrl);
      } catch (err) {
        console.error('Error during OAuth callback:', err);
        setError('Authentication failed. Please try again.');
        setTimeout(() => router.push('/auth/login?error=oauth_failed'), 2000);
      }
    };

    handleCallback();
  }, [searchParams, router, setTokens, setUser]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <div className="text-charcoal text-sm">Redirecting to login...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="text-center">
        <div className="text-charcoal text-xl mb-4">Completing sign in...</div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto"></div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="text-charcoal text-xl mb-4">Loading...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto"></div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
