import { create } from 'zustand';
import type { User, UserProfileUpdate } from '@/types';
import { authApi } from '@/lib/api';
import {
  setAccessToken as saveAccessToken,
  setRefreshToken as saveRefreshToken,
  getAccessToken,
  getRefreshToken,
  clearTokens
} from '@/lib/auth-storage';

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;

  // Data Actions
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (updates: UserProfileUpdate) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  token: typeof window !== 'undefined' ? getAccessToken() : null,
  refreshToken: typeof window !== 'undefined' ? getRefreshToken() : null,
  isAuthenticated: false,

  // Auth actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: (token) => {
    if (token) {
      saveAccessToken(token);
    }
    set({ token });
  },

  setRefreshToken: (refreshToken) => {
    if (refreshToken) {
      saveRefreshToken(refreshToken);
    }
    set({ refreshToken });
  },

  setTokens: (accessToken, refreshToken) => {
    saveAccessToken(accessToken);
    saveRefreshToken(refreshToken);
    set({ token: accessToken, refreshToken });
  },

  logout: () => {
    clearTokens();
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  // Data actions
  fetchUserProfile: async () => {
    try {
      const user = await authApi.getUserProfile();
      set({ user, isAuthenticated: true });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  },

  updateUserProfile: async (updates) => {
    try {
      const user = await authApi.updateUserProfile(updates);
      set({ user });
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  },
}));
