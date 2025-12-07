'use client';

import { useEffect, useState } from 'react';
import { initializeAuth, authApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { getAccessToken } from '@/lib/auth-storage';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider - Initializes auth state on app load
 *
 * Handles:
 * - Checking if access token is valid or expired
 * - Silently refreshing if refresh token exists
 * - Setting up proactive refresh timer
 * - Fetching user profile on successful auth
 * - Cross-tab auth state synchronization
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const { setUser, logout } = useStore();

  useEffect(() => {
    const initAuth = async () => {
      // Initialize auth (refresh tokens if needed)
      const isAuthenticated = await initializeAuth();

      if (isAuthenticated) {
        // Fetch user profile after successful auth
        try {
          const user = await authApi.getUserProfile();
          setUser(user);
        } catch (error) {
          console.error('Failed to fetch user profile on init:', error);
          // If we can't get the profile, the token might be invalid
          // Let the interceptor handle 401 errors
        }
      }

      setIsInitialized(true);
    };

    initAuth();
  }, [setUser]);

  // Listen for storage changes (cross-tab logout)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // If access_token or refresh_token was removed in another tab
      if (event.key === 'access_token' || event.key === 'refresh_token') {
        if (event.newValue === null && event.oldValue !== null) {
          // Token was removed - log out this tab too
          logout();
          // Redirect to login if not already there
          if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
        } else if (event.newValue !== null && event.oldValue === null) {
          // Token was added - refresh the page to pick up new auth state
          window.location.reload();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [logout]);

  // Also check token validity on window focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      const token = getAccessToken();
      const { user } = useStore.getState();

      // If we have a user in state but no token, logout
      if (user && !token) {
        logout();
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login';
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [logout]);

  // Show nothing while initializing to prevent flash
  if (!isInitialized) {
    return null;
  }

  return <>{children}</>;
}
