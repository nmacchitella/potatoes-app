import axios, { AxiosError } from 'axios';
import type {
  AuthResponse, LoginRequest, RegisterRequest, User, UserProfileUpdate,
  UserSettings, UserSettingsUpdate,
  Recipe, RecipeWithScale, RecipeSummary, RecipeListResponse, RecipeListParams,
  RecipeCreateInput, RecipeUpdateInput, RecipeImportResponse, RecipeImportMultiResponse,
  Collection, CollectionWithRecipes, CollectionCreateInput, CollectionUpdateInput,
  Tag, ParsedIngredient, Ingredient, MeasurementUnit,
  UserSearchResult, UserProfilePublic, FollowResponse, Notification,
  SearchResponse, FullSearchResponse,
} from '@/types';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
  isTokenExpiringSoon,
  getSecondsUntilExpiry,
} from './auth-storage';

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/** API error response structure from backend */
interface ApiErrorResponse {
  detail?: string;
  message?: string;
}

/** Type guard to check if error is an Axios error */
export function isAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return axios.isAxiosError(error);
}

/**
 * Extract error message from an error object
 * Handles Axios errors, Error objects, and unknown errors
 */
export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (isAxiosError(error)) {
    return error.response?.data?.detail || error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

const getApiUrl = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  }

  if (window.location.hostname === 'potatoes-frontend.fly.dev') {
    return 'https://potatoes-backend.fly.dev/api';
  }

  if (window.location.hostname === 'potatoes-frontend-dev.fly.dev') {
    return 'https://potatoes-backend-dev.fly.dev/api';
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8000/api`;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// TOKEN REFRESH LOGIC
// ============================================================================

let isRefreshing = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let failedQueue: Array<{
  resolve: (value?: string | null) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Perform token refresh
 * @returns New access token or null if refresh failed
 */
async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken
    });

    const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;

    setAccessToken(access_token, expires_in);
    setRefreshToken(new_refresh_token);

    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

    // Schedule next proactive refresh
    scheduleProactiveRefresh(expires_in);

    return access_token;
  } catch {
    return null;
  }
}

/**
 * Schedule proactive token refresh before expiry
 * Refreshes 60 seconds before token expires
 */
function scheduleProactiveRefresh(expiresIn?: number) {
  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  // Calculate when to refresh (60 seconds before expiry)
  const secondsUntilRefresh = expiresIn
    ? Math.max(expiresIn - 60, 10) // At least 10 seconds
    : Math.max(getSecondsUntilExpiry() - 60, 10);

  if (secondsUntilRefresh <= 0) {
    return; // Token already expired or no expiry info
  }

  refreshTimer = setTimeout(async () => {
    if (!isRefreshing && getRefreshToken()) {
      isRefreshing = true;
      await performTokenRefresh();
      isRefreshing = false;
    }
  }, secondsUntilRefresh * 1000);
}

/**
 * Initialize auth state on app load
 * Attempts to refresh tokens if access token is expired but refresh token exists
 */
export async function initializeAuth(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  // No tokens at all
  if (!refreshToken) {
    clearTokens();
    return false;
  }

  // Access token exists and not expiring soon
  if (accessToken && !isTokenExpiringSoon(120)) { // 2 minute buffer
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    scheduleProactiveRefresh();
    return true;
  }

  // Try to refresh
  isRefreshing = true;
  const newToken = await performTokenRefresh();
  isRefreshing = false;

  if (newToken) {
    return true;
  }

  // Refresh failed, clear everything
  clearTokens();
  return false;
}

/**
 * Stop proactive refresh (call on logout)
 */
export function stopProactiveRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// Request interceptor - add token to requests
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 and refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const newToken = await performTokenRefresh();

      if (newToken) {
        processQueue(null, newToken);
        isRefreshing = false;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }

      // Refresh failed
      processQueue(error, null);
      isRefreshing = false;
      clearTokens();
      stopProactiveRefresh();

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  register: async (data: RegisterRequest): Promise<User> => {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login-json', data);
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Silently fail - we'll clear local tokens regardless
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  updateProfile: async (data: { name?: string; email?: string }): Promise<User> => {
    const response = await api.put<User>('/auth/me', data);
    return response.data;
  },

  changePassword: async (data: { current_password: string; new_password: string }): Promise<{ message: string }> => {
    const response = await api.put<{ message: string }>('/auth/me/password', data);
    return response.data;
  },

  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>('/auth/me');
    return response.data;
  },

  googleLogin: async (): Promise<{ authorization_url: string }> => {
    const response = await api.get<{ authorization_url: string }>('/auth/google/login');
    return response.data;
  },

  getUserProfile: async (): Promise<User> => {
    const response = await api.get<User>('/auth/profile');
    return response.data;
  },

  updateUserProfile: async (data: UserProfileUpdate): Promise<User> => {
    const response = await api.patch<User>('/auth/profile', data);
    return response.data;
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/verify-email', null, { params: { token } });
    return response.data;
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/resend-verification', null, { params: { email } });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/forgot-password', null, { params: { email } });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/reset-password', null, {
      params: { token, new_password: newPassword }
    });
    return response.data;
  },

  getSettings: async (): Promise<UserSettings> => {
    const response = await api.get<UserSettings>('/auth/settings');
    return response.data;
  },

  updateSettings: async (data: UserSettingsUpdate): Promise<UserSettings> => {
    const response = await api.patch<UserSettings>('/auth/settings', data);
    return response.data;
  },
};

// ============================================================================
// RECIPE API
// ============================================================================

export const recipeApi = {
  list: async (params?: RecipeListParams): Promise<RecipeListResponse> => {
    const response = await api.get<RecipeListResponse>('/recipes', { params });
    return response.data;
  },

  get: async (id: string, scale?: number): Promise<RecipeWithScale> => {
    const params = scale ? { scale } : undefined;
    const response = await api.get<RecipeWithScale>(`/recipes/${id}`, { params });
    return response.data;
  },

  create: async (data: RecipeCreateInput): Promise<Recipe> => {
    const response = await api.post<Recipe>('/recipes', data);
    return response.data;
  },

  update: async (id: string, data: RecipeUpdateInput): Promise<Recipe> => {
    const response = await api.put<Recipe>(`/recipes/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/recipes/${id}`);
  },

  clone: async (id: string): Promise<Recipe> => {
    const response = await api.post<Recipe>(`/recipes/${id}/clone`);
    return response.data;
  },

  parseIngredients: async (text: string): Promise<{ ingredients: ParsedIngredient[] }> => {
    const response = await api.post<{ ingredients: ParsedIngredient[] }>('/recipes/parse-ingredients', { text });
    return response.data;
  },

  getPublicFeed: async (page?: number, pageSize?: number): Promise<RecipeListResponse> => {
    const response = await api.get<RecipeListResponse>('/recipes/public/feed', {
      params: { page, page_size: pageSize }
    });
    return response.data;
  },

  importFromUrl: async (url: string): Promise<RecipeImportMultiResponse> => {
    const response = await api.post<RecipeImportMultiResponse>('/recipes/import', { url });
    return response.data;
  },

  getCollections: async (id: string): Promise<Collection[]> => {
    const response = await api.get<Collection[]>(`/recipes/${id}/collections`);
    return response.data;
  },
};

// ============================================================================
// COLLECTION API
// ============================================================================

export const collectionApi = {
  list: async (): Promise<Collection[]> => {
    const response = await api.get<Collection[]>('/collections');
    return response.data;
  },

  get: async (id: string): Promise<CollectionWithRecipes> => {
    const response = await api.get<CollectionWithRecipes>(`/collections/${id}`);
    return response.data;
  },

  create: async (data: CollectionCreateInput): Promise<Collection> => {
    const response = await api.post<Collection>('/collections', data);
    return response.data;
  },

  update: async (id: string, data: CollectionUpdateInput): Promise<Collection> => {
    const response = await api.put<Collection>(`/collections/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/collections/${id}`);
  },

  addRecipe: async (collectionId: string, recipeId: string): Promise<void> => {
    await api.post(`/collections/${collectionId}/recipes/${recipeId}`);
  },

  removeRecipe: async (collectionId: string, recipeId: string): Promise<void> => {
    await api.delete(`/collections/${collectionId}/recipes/${recipeId}`);
  },
};

// ============================================================================
// TAG API
// ============================================================================

export const tagApi = {
  list: async (category?: string, search?: string): Promise<Tag[]> => {
    const response = await api.get<Tag[]>('/tags', {
      params: { category, search }
    });
    return response.data;
  },

  create: async (name: string, category?: string): Promise<Tag> => {
    const response = await api.post<Tag>('/tags', { name, category });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tags/${id}`);
  },
};

// ============================================================================
// SOCIAL API
// ============================================================================

export const socialApi = {
  searchUsers: async (query: string, limit?: number): Promise<UserSearchResult[]> => {
    const response = await api.get<UserSearchResult[]>('/users/search', {
      params: { q: query, limit }
    });
    return response.data;
  },

  getUserProfile: async (username: string): Promise<UserProfilePublic> => {
    const response = await api.get<UserProfilePublic>(`/users/${username}`);
    return response.data;
  },

  getUserRecipes: async (username: string, page?: number, pageSize?: number): Promise<RecipeListResponse> => {
    const response = await api.get<RecipeListResponse>(`/users/${username}/recipes`, {
      params: { page, page_size: pageSize }
    });
    return response.data;
  },

  follow: async (userId: string): Promise<FollowResponse> => {
    const response = await api.post<FollowResponse>(`/users/${userId}/follow`);
    return response.data;
  },

  unfollow: async (userId: string): Promise<FollowResponse> => {
    const response = await api.delete<FollowResponse>(`/users/${userId}/follow`);
    return response.data;
  },

  getFollowers: async (): Promise<UserSearchResult[]> => {
    const response = await api.get<UserSearchResult[]>('/users/me/followers');
    return response.data;
  },

  getFollowing: async (): Promise<UserSearchResult[]> => {
    const response = await api.get<UserSearchResult[]>('/users/me/following');
    return response.data;
  },

  getFollowRequests: async (): Promise<UserSearchResult[]> => {
    const response = await api.get<UserSearchResult[]>('/users/me/follow-requests');
    return response.data;
  },

  acceptFollowRequest: async (userId: string): Promise<FollowResponse> => {
    const response = await api.post<FollowResponse>(`/users/me/follow-requests/${userId}/accept`);
    return response.data;
  },

  declineFollowRequest: async (userId: string): Promise<FollowResponse> => {
    const response = await api.post<FollowResponse>(`/users/me/follow-requests/${userId}/decline`);
    return response.data;
  },

  getFeed: async (page?: number, pageSize?: number): Promise<RecipeListResponse> => {
    const response = await api.get<RecipeListResponse>('/users/me/feed', {
      params: { page, page_size: pageSize }
    });
    return response.data;
  },
};

// ============================================================================
// NOTIFICATION API
// ============================================================================

export const notificationApi = {
  list: async (unreadOnly?: boolean, limit?: number, offset?: number): Promise<Notification[]> => {
    const response = await api.get<Notification[]>('/notifications', {
      params: { unread_only: unreadOnly, limit, offset }
    });
    return response.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get<{ count: number }>('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    await api.post(`/notifications/${notificationId}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post('/notifications/read-all');
  },

  delete: async (notificationId: string): Promise<void> => {
    await api.delete(`/notifications/${notificationId}`);
  },
};

// ============================================================================
// INGREDIENT API
// ============================================================================

export const ingredientApi = {
  list: async (search?: string, category?: string, limit?: number): Promise<Ingredient[]> => {
    const response = await api.get<Ingredient[]>('/ingredients', {
      params: { search, category, limit }
    });
    return response.data;
  },

  get: async (id: string): Promise<Ingredient> => {
    const response = await api.get<Ingredient>(`/ingredients/${id}`);
    return response.data;
  },

  create: async (name: string, category?: string): Promise<Ingredient> => {
    const response = await api.post<Ingredient>('/ingredients', { name, category });
    return response.data;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/ingredients/categories');
    return response.data;
  },

  getUnits: async (search?: string, type?: string): Promise<MeasurementUnit[]> => {
    const response = await api.get<MeasurementUnit[]>('/ingredients/units', {
      params: { search, type }
    });
    return response.data;
  },
};

// ============================================================================
// SEARCH API
// ============================================================================

export const searchApi = {
  autocomplete: async (query: string, limit?: number): Promise<SearchResponse> => {
    const response = await api.get<SearchResponse>('/search', {
      params: { q: query, limit }
    });
    return response.data;
  },

  full: async (query: string, page?: number, pageSize?: number, category?: string): Promise<FullSearchResponse> => {
    const response = await api.get<FullSearchResponse>('/search/full', {
      params: { q: query, page, page_size: pageSize, category }
    });
    return response.data;
  },

  getRecipesByIngredient: async (ingredientId: string, page?: number, pageSize?: number): Promise<RecipeListResponse> => {
    const response = await api.get<RecipeListResponse>(`/search/ingredients/${ingredientId}/recipes`, {
      params: { page, page_size: pageSize }
    });
    return response.data;
  },
};

export default api;
