import axios from 'axios';
import type {
  AuthResponse, LoginRequest, RegisterRequest, User, UserProfileUpdate,
  Recipe, RecipeWithScale, RecipeSummary, RecipeListResponse, RecipeListParams,
  RecipeCreateInput, RecipeUpdateInput, RecipeImportResponse, RecipeImportMultiResponse,
  Collection, CollectionWithRecipes, CollectionCreateInput, CollectionUpdateInput,
  Tag, ParsedIngredient, Ingredient, MeasurementUnit,
  UserSearchResult, UserProfilePublic, FollowResponse, Notification,
} from '@/types';

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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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

      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });

        const { access_token, refresh_token: new_refresh_token } = response.data;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', new_refresh_token);

        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        processQueue(null, access_token);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
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
    const response = await api.post<{ message: string }>(`/auth/verify-email?token=${token}`);
    return response.data;
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/auth/resend-verification?email=${email}`);
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/auth/forgot-password?email=${email}`);
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/auth/reset-password?token=${token}&new_password=${newPassword}`);
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

export default api;
