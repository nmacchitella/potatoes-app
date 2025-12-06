'use client';

import { useEffect, useState } from 'react';
import { initializeAuth } from '@/lib/api';

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
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize auth on mount
    initializeAuth().finally(() => {
      setIsInitialized(true);
    });
  }, []);

  // Show nothing while initializing to prevent flash
  // This is brief since it only checks localStorage
  if (!isInitialized) {
    return null;
  }

  return <>{children}</>;
}
