import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, UserProfileUpdate } from '@/types';
import { authApi, stopProactiveRefresh } from '@/lib/api';
import {
  setAccessToken as saveAccessToken,
  setRefreshToken as saveRefreshToken,
  getRefreshToken,
  clearTokens,
} from '@/lib/auth-storage';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => Promise<void>;
  logout: () => Promise<void>;

  // Data Actions
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (updates: UserProfileUpdate) => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,

      // Auth actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setLoading: (isLoading) => set({ isLoading }),

      setTokens: async (accessToken, refreshToken, expiresIn) => {
        await saveAccessToken(accessToken, expiresIn);
        await saveRefreshToken(refreshToken);
      },

      logout: async () => {
        const refreshToken = getRefreshToken();

        stopProactiveRefresh();

        if (refreshToken) {
          authApi.logout(refreshToken);
        }

        await clearTokens();
        set({
          user: null,
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
    }),
    {
      name: 'potatoes-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
