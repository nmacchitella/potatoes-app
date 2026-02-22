import axios, { AxiosError } from 'axios';
import type {
  AuthResponse, LoginRequest, RegisterRequest, User, UserProfileUpdate,
  UserSettings, UserSettingsUpdate,
  Recipe, RecipeWithScale, RecipeSummary, RecipeListResponse, RecipeListParams,
  RecipeCreateInput, RecipeUpdateInput, RecipeImportResponse, RecipeImportMultiResponse,
  Collection, CollectionWithRecipes, CollectionCreateInput, CollectionUpdateInput,
  CollectionShare, CollectionShareCreateInput, CollectionShareUpdateInput, SharedCollection,
  Tag, ParsedIngredient, Ingredient, MeasurementUnit,
  UserSearchResult, UserProfilePublic, FollowResponse, Notification,
  SearchResponse, FullSearchResponse,
  MealPlanCalendar, MealPlanCalendarCreateInput, MealPlanCalendarUpdateInput,
  MealPlan, MealPlanCreateInput, MealPlanUpdateInput, MealPlanMoveInput,
  MealPlanCopyInput, MealPlanRecurringInput, MealPlanListResponse,
  MealPlanCalendarShare, SharedMealPlanCalendarAccess,
  MealPlanCalendarShareCreateInput, MealPlanCalendarShareUpdateInput,
  GroceryList, GroceryListSummary, GroceryListItem, GroceryListCreateInput, GroceryListUpdateInput,
  GroceryListItemCreateInput, GroceryListItemUpdateInput, GroceryListGenerateInput,
  GroceryListShare, GroceryListShareCreateInput, GroceryListShareUpdateInput, SharedGroceryListAccess,
  GroceryListEmailShareResponse, GroceryListAcceptPublicShareResponse,
  LibraryShareResponse, LibraryPartner, PendingLibraryInvite, LibraryShareCreateInput,
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
    const detail = error.response?.data?.detail;

    // Handle Pydantic validation errors (array of objects)
    if (Array.isArray(detail)) {
      // Extract first error message, or summarize
      const firstError = detail[0];
      if (firstError?.msg) {
        // Format: "field: message" or just "message"
        const loc = firstError.loc?.slice(-1)[0]; // Get last part of location
        return loc && typeof loc === 'string'
          ? `${loc}: ${firstError.msg}`
          : firstError.msg;
      }
      return `Validation error: ${detail.length} field(s) invalid`;
    }

    // Handle string detail or message
    if (typeof detail === 'string') {
      return detail;
    }

    return error.response?.data?.message || error.message || fallback;
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
  // NEXT_PUBLIC_API_URL should be set in all environments (development, staging, production)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Fallback for local development when env var is not set
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/api';
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

      if (typeof window !== 'undefined' && window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login';
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

  exchangeOAuthCode: async (code: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/google/exchange', { code });
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

  uploadImage: async (recipeId: string, file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{ url: string }>(`/recipes/${recipeId}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

  parseFromText: async (text: string): Promise<RecipeImportMultiResponse> => {
    const response = await api.post<RecipeImportMultiResponse>('/recipes/parse-text', { text });
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

  // Sharing methods
  listSharedWithMe: async (): Promise<SharedCollection[]> => {
    const response = await api.get<SharedCollection[]>('/collections/shared-with-me');
    return response.data;
  },

  listShares: async (collectionId: string): Promise<CollectionShare[]> => {
    const response = await api.get<CollectionShare[]>(`/collections/${collectionId}/shares`);
    return response.data;
  },

  share: async (collectionId: string, data: CollectionShareCreateInput): Promise<CollectionShare> => {
    const response = await api.post<CollectionShare>(`/collections/${collectionId}/shares`, data);
    return response.data;
  },

  updateShare: async (collectionId: string, userId: string, data: CollectionShareUpdateInput): Promise<CollectionShare> => {
    const response = await api.put<CollectionShare>(`/collections/${collectionId}/shares/${userId}`, data);
    return response.data;
  },

  removeShare: async (collectionId: string, userId: string): Promise<void> => {
    await api.delete(`/collections/${collectionId}/shares/${userId}`);
  },

  leave: async (collectionId: string): Promise<void> => {
    await api.delete(`/collections/${collectionId}/leave`);
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

  update: async (id: string, data: { category?: string }): Promise<Ingredient> => {
    const response = await api.patch<Ingredient>(`/ingredients/${id}`, data);
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

// ============================================================================
// MEAL PLAN API
// ============================================================================

export const mealPlanApi = {
  // Calendar CRUD
  listCalendars: async (): Promise<MealPlanCalendar[]> => {
    const response = await api.get<MealPlanCalendar[]>('/meal-plan/calendars');
    return response.data;
  },

  createCalendar: async (data?: MealPlanCalendarCreateInput): Promise<MealPlanCalendar> => {
    const response = await api.post<MealPlanCalendar>('/meal-plan/calendars', data || {});
    return response.data;
  },

  updateCalendar: async (calendarId: string, data: MealPlanCalendarUpdateInput): Promise<MealPlanCalendar> => {
    const response = await api.patch<MealPlanCalendar>(`/meal-plan/calendars/${calendarId}`, data);
    return response.data;
  },

  deleteCalendar: async (calendarId: string): Promise<void> => {
    await api.delete(`/meal-plan/calendars/${calendarId}`);
  },

  // Calendar sharing
  listCalendarShares: async (calendarId: string): Promise<MealPlanCalendarShare[]> => {
    const response = await api.get<MealPlanCalendarShare[]>(`/meal-plan/calendars/${calendarId}/shares`);
    return response.data;
  },

  shareCalendar: async (calendarId: string, data: MealPlanCalendarShareCreateInput): Promise<MealPlanCalendarShare> => {
    const response = await api.post<MealPlanCalendarShare>(`/meal-plan/calendars/${calendarId}/shares`, data);
    return response.data;
  },

  updateCalendarShare: async (calendarId: string, userId: string, data: MealPlanCalendarShareUpdateInput): Promise<MealPlanCalendarShare> => {
    const response = await api.patch<MealPlanCalendarShare>(`/meal-plan/calendars/${calendarId}/shares/${userId}`, data);
    return response.data;
  },

  removeCalendarShare: async (calendarId: string, userId: string): Promise<void> => {
    await api.delete(`/meal-plan/calendars/${calendarId}/shares/${userId}`);
  },

  leaveCalendar: async (calendarId: string): Promise<void> => {
    await api.delete(`/meal-plan/calendars/${calendarId}/leave`);
  },

  // List shared with me (shows calendars shared with current user)
  listSharedWithMe: async (): Promise<SharedMealPlanCalendarAccess[]> => {
    const response = await api.get<SharedMealPlanCalendarAccess[]>('/meal-plan/shared-with-me');
    return response.data;
  },

  // Meal plan item methods
  list: async (start: string, end: string, calendarIds?: string[]): Promise<MealPlanListResponse> => {
    const response = await api.get<MealPlanListResponse>('/meal-plan', {
      params: { start, end, calendar_ids: calendarIds }
    });
    return response.data;
  },

  get: async (id: string): Promise<MealPlan> => {
    const response = await api.get<MealPlan>(`/meal-plan/${id}`);
    return response.data;
  },

  create: async (data: MealPlanCreateInput): Promise<MealPlan> => {
    const response = await api.post<MealPlan>('/meal-plan', data);
    return response.data;
  },

  update: async (id: string, data: MealPlanUpdateInput): Promise<MealPlan> => {
    const response = await api.patch<MealPlan>(`/meal-plan/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/meal-plan/${id}`);
  },

  move: async (id: string, data: MealPlanMoveInput): Promise<MealPlan> => {
    const response = await api.post<MealPlan>(`/meal-plan/${id}/move`, data);
    return response.data;
  },

  copy: async (data: MealPlanCopyInput, calendarId?: string): Promise<MealPlan[]> => {
    const response = await api.post<MealPlan[]>('/meal-plan/copy', data, {
      params: calendarId ? { calendar_id: calendarId } : undefined
    });
    return response.data;
  },

  createRecurring: async (data: MealPlanRecurringInput, calendarId: string): Promise<MealPlan[]> => {
    const response = await api.post<MealPlan[]>('/meal-plan/recurring', data, {
      params: { calendar_id: calendarId }
    });
    return response.data;
  },

  deleteRecurring: async (recurrenceId: string, futureOnly: boolean = true): Promise<{ status: string; count: number }> => {
    const response = await api.delete<{ status: string; count: number }>(`/meal-plan/recurring/${recurrenceId}`, {
      params: { future_only: futureOnly }
    });
    return response.data;
  },

  swap: async (mealPlanId1: string, mealPlanId2: string): Promise<{ status: string }> => {
    const response = await api.post<{ status: string }>('/meal-plan/swap', null, {
      params: { meal_plan_id_1: mealPlanId1, meal_plan_id_2: mealPlanId2 }
    });
    return response.data;
  },
};

// ============================================================================
// GROCERY LIST API
// ============================================================================

export const groceryListApi = {
  // List CRUD
  list: async (): Promise<GroceryListSummary[]> => {
    const response = await api.get<GroceryListSummary[]>('/grocery-list');
    return response.data;
  },

  create: async (data?: GroceryListCreateInput): Promise<GroceryListSummary> => {
    const response = await api.post<GroceryListSummary>('/grocery-list', data || {});
    return response.data;
  },

  get: async (listId: string): Promise<GroceryList> => {
    const response = await api.get<GroceryList>(`/grocery-list/${listId}`);
    return response.data;
  },

  update: async (listId: string, data: GroceryListUpdateInput): Promise<GroceryListSummary> => {
    const response = await api.patch<GroceryListSummary>(`/grocery-list/${listId}`, data);
    return response.data;
  },

  delete: async (listId: string): Promise<void> => {
    await api.delete(`/grocery-list/${listId}`);
  },

  generate: async (listId: string, data: GroceryListGenerateInput): Promise<GroceryList> => {
    const response = await api.post<GroceryList>(`/grocery-list/${listId}/generate`, data);
    return response.data;
  },

  clear: async (listId: string, checkedOnly: boolean = false): Promise<{ deleted: number }> => {
    const response = await api.delete<{ deleted: number }>(`/grocery-list/${listId}/clear`, {
      params: { checked_only: checkedOnly }
    });
    return response.data;
  },

  // Item methods
  addItem: async (listId: string, data: GroceryListItemCreateInput): Promise<GroceryListItem> => {
    const response = await api.post<GroceryListItem>(`/grocery-list/${listId}/items`, data);
    return response.data;
  },

  updateItem: async (listId: string, itemId: string, data: GroceryListItemUpdateInput): Promise<GroceryListItem> => {
    const response = await api.patch<GroceryListItem>(`/grocery-list/${listId}/items/${itemId}`, data);
    return response.data;
  },

  deleteItem: async (listId: string, itemId: string): Promise<void> => {
    await api.delete(`/grocery-list/${listId}/items/${itemId}`);
  },

  bulkCheck: async (listId: string, itemIds: string[], isChecked: boolean): Promise<{ updated: number }> => {
    const response = await api.patch<{ updated: number }>(`/grocery-list/${listId}/items/bulk-check`, {
      item_ids: itemIds,
      is_checked: isChecked
    });
    return response.data;
  },

  // User sharing methods
  listSharedWithMe: async (): Promise<SharedGroceryListAccess[]> => {
    const response = await api.get<SharedGroceryListAccess[]>('/grocery-list/shared-with-me');
    return response.data;
  },

  listShares: async (listId: string): Promise<GroceryListShare[]> => {
    const response = await api.get<GroceryListShare[]>(`/grocery-list/${listId}/shares`);
    return response.data;
  },

  share: async (listId: string, data: GroceryListShareCreateInput): Promise<GroceryListShare> => {
    const response = await api.post<GroceryListShare>(`/grocery-list/${listId}/shares`, data);
    return response.data;
  },

  removeShare: async (listId: string, userId: string): Promise<void> => {
    await api.delete(`/grocery-list/${listId}/shares/${userId}`);
  },

  acceptShare: async (shareId: string): Promise<void> => {
    await api.post(`/grocery-list/shares/${shareId}/accept`);
  },

  declineShare: async (shareId: string): Promise<void> => {
    await api.post(`/grocery-list/shares/${shareId}/decline`);
  },

  leaveSharedList: async (shareId: string): Promise<void> => {
    await api.delete(`/grocery-list/shares/${shareId}/leave`);
  },

  // Public share link methods
  getOrCreateShareLink: async (listId: string): Promise<{ share_token: string }> => {
    const response = await api.post<{ share_token: string }>(`/grocery-list/${listId}/share-link`);
    return response.data;
  },

  disableShareLink: async (listId: string): Promise<void> => {
    await api.delete(`/grocery-list/${listId}/share-link`);
  },

  getPublicGroceryList: async (token: string): Promise<GroceryList> => {
    const response = await api.get<GroceryList>(`/grocery-list/public/${token}`);
    return response.data;
  },

  // Email share method
  shareViaEmail: async (listId: string, email: string): Promise<GroceryListEmailShareResponse> => {
    const response = await api.post<GroceryListEmailShareResponse>(`/grocery-list/${listId}/share-email`, { email });
    return response.data;
  },

  // Accept public share link (for logged-in users)
  acceptPublicShare: async (token: string): Promise<GroceryListAcceptPublicShareResponse> => {
    const response = await api.post<GroceryListAcceptPublicShareResponse>(`/grocery-list/public/${token}/accept`);
    return response.data;
  },
};

// ============================================================================
// LIBRARY SHARING API (Partner/Family Sharing)
// ============================================================================

export const libraryApi = {
  // Get all library partners (accepted shares)
  getPartners: async (): Promise<LibraryPartner[]> => {
    const response = await api.get<LibraryPartner[]>('/library/partners');
    return response.data;
  },

  // Get pending invitations received
  getPendingInvites: async (): Promise<PendingLibraryInvite[]> => {
    const response = await api.get<PendingLibraryInvite[]>('/library/invites/pending');
    return response.data;
  },

  // Get pending invitations sent
  getSentInvites: async (): Promise<LibraryShareResponse[]> => {
    const response = await api.get<LibraryShareResponse[]>('/library/invites/sent');
    return response.data;
  },

  // Invite a user to share libraries
  invite: async (data: LibraryShareCreateInput): Promise<LibraryShareResponse> => {
    const response = await api.post<LibraryShareResponse>('/library/invite', data);
    return response.data;
  },

  // Accept an invitation
  acceptInvite: async (shareId: string): Promise<LibraryShareResponse> => {
    const response = await api.post<LibraryShareResponse>(`/library/invites/${shareId}/accept`);
    return response.data;
  },

  // Decline an invitation
  declineInvite: async (shareId: string): Promise<void> => {
    await api.post(`/library/invites/${shareId}/decline`);
  },

  // Cancel a sent invitation
  cancelInvite: async (shareId: string): Promise<void> => {
    await api.delete(`/library/invites/${shareId}`);
  },

  // Remove a library partner
  removePartner: async (partnerId: string): Promise<void> => {
    await api.delete(`/library/partners/${partnerId}`);
  },
};

export default api;
