# Mobile App

React Native/Expo mobile application for Potatoes.

## Overview

The mobile app is built with **Expo** (SDK 54) and **React Native**, sharing similar patterns with the web frontend including Zustand for state management and Tailwind-style styling via NativeWind.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Expo 54** | React Native framework & build tools |
| **React Native 0.81** | Cross-platform UI |
| **React 19** | UI library |
| **React Navigation 7** | Native navigation |
| **Zustand 5** | State management with AsyncStorage persistence |
| **NativeWind 4** | Tailwind CSS for React Native |
| **Axios** | HTTP client |
| **Expo SecureStore** | Secure token storage |
| **Expo Image Picker** | Camera and photo library access |
| **Expo Auth Session** | OAuth authentication |

## Project Structure

```
mobile/
├── App.tsx                 # Entry point with providers
├── app.json                # Expo configuration
├── index.ts                # Registration
├── global.css              # Global Tailwind styles
├── tailwind.config.js      # NativeWind/Tailwind config
├── src/
│   ├── screens/            # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── RecipeDetailScreen.tsx
│   │   ├── AddRecipeScreen.tsx
│   │   ├── EditRecipeScreen.tsx
│   │   ├── CollectionDetailScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── NotificationsScreen.tsx
│   │   ├── UserProfileScreen.tsx
│   │   ├── EditProfileScreen.tsx
│   │   ├── DayDetailScreen.tsx
│   │   ├── FollowRequestsScreen.tsx
│   │   ├── FollowListScreen.tsx
│   │   └── ForgotPasswordScreen.tsx
│   ├── components/         # Shared components
│   │   ├── ui/             # Base UI components
│   │   │   └── UserAvatar.tsx
│   │   ├── recipes/        # Recipe components
│   │   │   ├── RecipeCard.tsx
│   │   │   ├── TagFilterBar.tsx
│   │   │   └── TagSelector.tsx
│   │   ├── calendar/       # Meal plan calendar
│   │   │   ├── WeekView.tsx
│   │   │   ├── MonthView.tsx
│   │   │   ├── DayView.tsx
│   │   │   └── RecipePickerModal.tsx
│   │   ├── collections/    # Collection components
│   │   │   └── AddToCollectionModal.tsx
│   │   └── layout/         # Layout components
│   │       ├── MobileSidebar.tsx
│   │       └── TopBar.tsx
│   ├── navigation/         # React Navigation setup
│   │   ├── RootNavigator.tsx
│   │   ├── TabNavigator.tsx
│   │   └── AuthStack.tsx
│   ├── store/              # Zustand state
│   │   └── useStore.ts
│   ├── hooks/              # Custom hooks
│   │   ├── useDebounce.ts
│   │   ├── useGoogleAuth.ts
│   │   ├── useImagePicker.ts
│   │   ├── useMealPlan.ts
│   │   └── useTags.ts
│   ├── lib/                # Utilities
│   │   ├── api.ts          # Axios client with auth
│   │   └── auth-storage.ts # SecureStore token management
│   └── types/              # TypeScript types
│       └── index.ts
├── assets/                 # Images, fonts
└── package.json
```

## Setup

### Prerequisites

- Node.js 18+
- Expo Go app (iOS/Android) for development
- Xcode (for iOS Simulator)
- Android Studio (for Android Emulator)

### Installation

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npm start
```

### Running the App

After `npm start`:

| Platform | Action |
|----------|--------|
| **iOS Simulator** | Press `i` |
| **Android Emulator** | Press `a` |
| **Physical Device** | Scan QR code with Expo Go |
| **Web** | Press `w` |

## Configuration

### Environment Variables

The app uses Expo environment variables:

```bash
# .env or set before running
EXPO_PUBLIC_API_URL=http://localhost:8000/api

# Google OAuth (optional)
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-ios-client-id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your-android-client-id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=your-web-client-id
```

The API URL defaults to `https://potatoes-backend.fly.dev/api` if not set.

For physical device testing, use your computer's local IP:
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
```

### app.json

```json
{
  "expo": {
    "name": "Potatoes",
    "slug": "potatoes",
    "scheme": "potatoes",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#F5F1E8"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.potatoes.app"
    },
    "android": {
      "package": "com.potatoes.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#F5F1E8"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-secure-store",
      "expo-web-browser"
    ]
  }
}
```

## Key Dependencies

```json
{
  "dependencies": {
    "expo": "~54.0.30",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "@react-navigation/native": "^7.1.26",
    "@react-navigation/native-stack": "^7.9.0",
    "@react-navigation/bottom-tabs": "^7.9.0",
    "@react-native-async-storage/async-storage": "2.2.0",
    "zustand": "^5.0.9",
    "axios": "^1.13.2",
    "nativewind": "^4.2.1",
    "tailwindcss": "^3.3.2",
    "expo-secure-store": "~15.0.8",
    "expo-image": "~3.0.11",
    "expo-image-picker": "~17.0.10",
    "expo-haptics": "~15.0.8",
    "expo-auth-session": "~7.0.10",
    "expo-web-browser": "~15.0.10",
    "@expo/vector-icons": "^15.0.3"
  }
}
```

## Navigation

Using React Navigation with conditional rendering based on auth state:

```typescript
// RootNavigator.tsx
export default function RootNavigator() {
  const { isAuthenticated } = useStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initialize() {
      const isLoggedIn = await initializeAuth();
      if (isLoggedIn) {
        await fetchUserProfile();
      }
      setIsInitializing(false);
    }
    initialize();
  }, []);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          {/* ... more screens */}
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}
```

### Tab Structure

The app has 3 main tabs with a centered floating action button:

| Tab | Screen | Icon |
|-----|--------|------|
| Home | Recipe feed & meal planning | Home |
| Add | Create recipe (FAB) | Plus |
| Profile | User profile | Avatar |

Additional features like Search and Meal Planning are accessed via the sidebar/modal.

## State Management

Zustand store with AsyncStorage persistence:

```typescript
// src/store/useStore.ts
interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (access: string, refresh: string, expiresIn?: number) => Promise<void>;
  logout: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (updates: UserProfileUpdate) => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setTokens: async (accessToken, refreshToken, expiresIn) => {
        await saveAccessToken(accessToken, expiresIn);
        await saveRefreshToken(refreshToken);
      },

      logout: async () => {
        stopProactiveRefresh();
        await clearTokens();
        set({ user: null, isAuthenticated: false });
      },
      // ...
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
```

## Token Management

Secure token storage with automatic refresh:

```typescript
// src/lib/auth-storage.ts
import * as SecureStore from 'expo-secure-store';

// Store tokens securely
await SecureStore.setItemAsync('accessToken', token);
await SecureStore.setItemAsync('refreshToken', refreshToken);

// Token expiry tracking
export function isTokenExpiringSoon(thresholdSeconds: number): boolean;
export function getSecondsUntilExpiry(): number;
```

The API client (`src/lib/api.ts`) includes:
- Automatic token refresh on 401 errors
- Proactive token refresh before expiry
- Request queue during refresh
- Retry logic for failed requests

## Styling

NativeWind enables Tailwind-like classes:

```typescript
import { View, Text } from 'react-native';

function RecipeCard({ recipe }) {
  return (
    <View className="bg-white rounded-lg p-4 shadow-sm mb-4">
      <Text className="text-lg font-bold text-gray-900">
        {recipe.title}
      </Text>
      <Text className="text-gray-600 mt-1">
        {recipe.description}
      </Text>
    </View>
  );
}
```

Custom colors are defined in `tailwind.config.js`:
- `cream` - #F5F1E8 (background)
- `gold` - #C6A664 (primary)
- `warm-gray` - #6B6560 (secondary text)

## API Client

Comprehensive API client with typed methods:

```typescript
// src/lib/api.ts
import { authApi, recipeApi, collectionApi, tagApi, socialApi,
         notificationApi, ingredientApi, searchApi, mealPlanApi } from '@/lib/api';

// Auth
await authApi.login({ email, password });
await authApi.register({ email, name, password });
await authApi.getCurrentUser();

// Recipes
await recipeApi.list({ page, page_size, search, tag_ids });
await recipeApi.create(recipeData);
await recipeApi.uploadImage(recipeId, imageUri);

// Collections
await collectionApi.list();
await collectionApi.addRecipe(collectionId, recipeId);

// And more...
```

## Building for Production

### Expo Build (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Local Build

```bash
# Export for web
npx expo export --platform web

# iOS (requires Xcode)
npx expo run:ios --configuration Release

# Android (requires Android Studio)
npx expo run:android --variant release
```

## Development Tips

### Hot Reload

Changes auto-reload. If stuck:
- Shake device -> "Reload"
- Press `r` in terminal

### Debugging

```bash
# Open React DevTools
npx react-devtools
```

Or use Expo's built-in debugger (shake device -> "Debug Remote JS").

### Testing on Physical Device

1. Install Expo Go from App Store / Play Store
2. Run `npm start`
3. Scan QR code with camera (iOS) or Expo Go app (Android)
4. Ensure phone and computer are on same network

### Common Issues

| Issue | Solution |
|-------|----------|
| Network error | Use computer's IP instead of localhost |
| Metro bundler stuck | Clear cache: `npx expo start --clear` |
| Pods error (iOS) | `cd ios && pod install` |
| Build failed | Check Expo SDK compatibility |

## Platform-Specific Code

```typescript
import { Platform } from 'react-native';

const styles = {
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
    },
    android: {
      elevation: 2,
    },
  }),
};
```

## Custom Hooks

The app includes several custom hooks:

| Hook | Purpose |
|------|---------|
| `useDebounce` | Debounce search input |
| `useGoogleAuth` | Google OAuth flow |
| `useImagePicker` | Camera/gallery image selection |
| `useMealPlan` | Meal plan data management |
| `useTags` | Tag fetching and caching |

## Future Improvements

- [ ] Push notifications (Expo Notifications)
- [ ] Offline support (local database)
- [ ] Deep linking
- [ ] Biometric authentication
- [ ] Share extension
