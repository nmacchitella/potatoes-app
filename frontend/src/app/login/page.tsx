'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { hasAccessTokenCookie } from '@/lib/auth-storage';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, setTokens, setUser, logout } = useStore();
  const returnUrl = searchParams.get('returnUrl') || '/recipes';

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await authApi.login({
          email: formData.email,
          password: formData.password,
        });
        setTokens(response.access_token, response.refresh_token);
        const user = await authApi.getCurrentUser();
        setUser(user);
        router.push(returnUrl);
      } else {
        await authApi.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });
        router.push(`/verification-required?email=${encodeURIComponent(formData.email)}`);
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || 'An error occurred';

      if (err.response?.status === 403 && errorDetail.toLowerCase().includes('verified')) {
        router.push(`/verification-required?email=${encodeURIComponent(formData.email)}`);
      } else {
        setError(errorDetail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const response = await authApi.googleLogin();
      window.location.href = response.authorization_url;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to initiate Google login');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-dark-bg">
      {/* Left side - Landing content */}
      <div className="hidden lg:flex lg:w-1/2 bg-dark-lighter p-12 flex-col justify-center relative overflow-hidden border-r border-gray-800/50">
        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold text-text-primary mb-6 tracking-tight">🥔 Potatoes</h1>
          <p className="text-2xl text-gray-400 mb-12 font-light">
            Your family kitchen, organized.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📖</span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-1">Organize Recipes</h3>
                <p className="text-gray-400 text-sm">Save and organize your family's favorite recipes in one place.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📅</span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-1">Plan Meals Together</h3>
                <p className="text-gray-400 text-sm">Collaborate with family members on weekly meal plans.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🛒</span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-1">Smart Shopping Lists</h3>
                <p className="text-gray-400 text-sm">Auto-generate shopping lists from your meal plan.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center lg:hidden">
            <h1 className="text-4xl font-bold text-text-primary mb-2 tracking-tight">🥔 Potatoes</h1>
            <p className="text-gray-400">Your family kitchen, organized</p>
          </div>

          <div className="hidden lg:block text-center">
            <h2 className="text-3xl font-bold text-text-primary mb-2">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-gray-400">
              {isLogin ? 'Sign in to access your recipes' : 'Start organizing your family meals'}
            </p>
          </div>

          <div className="card">
            <div className="flex justify-center mb-6">
              <div className="bg-dark-hover rounded-lg p-1 flex">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`px-6 py-2 rounded transition-colors font-medium ${isLogin
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-text-primary'
                    }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`px-6 py-2 rounded transition-colors font-medium ${!isLogin
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-text-primary'
                    }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required={!isLogin}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <a href="/forgot-password" className="text-sm text-primary hover:text-primary-hover hover:underline">
                    Forgot Password?
                  </a>
                </div>
              )}

              {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-dark-card text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? 'Loading...' : 'Sign in with Google'}
            </button>
          </div>

          <p className="text-center text-gray-500 text-sm">
            By signing up, you agree to organize your family meals together.
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
