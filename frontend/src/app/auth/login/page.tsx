'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, getErrorMessage } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { hasAccessTokenCookie } from '@/lib/auth-storage';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, logout } = useStore();
  const returnUrl = searchParams.get('returnUrl') || '/recipes';

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (token) {
      if (hasAccessTokenCookie()) {
        router.push(returnUrl);
      } else {
        logout();
      }
    }
  }, [token, router, returnUrl, logout]);

  if (mounted && token && hasAccessTokenCookie()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-white text-xl">Redirecting...</div>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const response = await authApi.googleLogin();
      window.location.href = response.authorization_url;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to initiate Google login'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-dark-bg">
      {/* Left side - Landing content */}
      <div className="hidden lg:flex lg:w-1/2 bg-dark-lighter p-12 flex-col justify-center relative overflow-hidden border-r border-gray-800/50">
        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold text-text-primary mb-6 tracking-tight">🥔 Potatoes</h1>
          <p className="text-2xl text-gray-400 font-light">
            Your family kitchen, organized.
          </p>
        </div>
      </div>

      {/* Right side - Auth */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center lg:hidden">
            <h1 className="text-4xl font-bold text-text-primary mb-2 tracking-tight">🥔 Potatoes</h1>
            <p className="text-gray-400">Your family kitchen, organized</p>
          </div>

          <div className="hidden lg:block text-center">
            <h2 className="text-3xl font-bold text-text-primary mb-2">
              Welcome
            </h2>
            <p className="text-gray-400">
              Sign in to access your recipes
            </p>
          </div>

          <div className="card">
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm mb-4">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? 'Loading...' : 'Continue with Google'}
            </button>
          </div>

          <p className="text-center text-gray-500 text-sm">
            By signing in, you agree to organize your family meals together.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
