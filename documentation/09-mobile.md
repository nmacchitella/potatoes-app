# Mobile App

React Native/Expo mobile application for Potatoes.

## Overview

The mobile app is built with **Expo** (SDK 54) and **React Native**, sharing similar patterns with the web frontend including Zustand for state management and Tailwind-style styling via NativeWind.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Expo 54** | React Native framework & build tools |
| **React Native 0.81** | Cross-platform UI |
| **React Navigation 7** | Native navigation |
| **Zustand** | State management |
| **NativeWind 4** | Tailwind CSS for React Native |
| **Axios** | HTTP client |
| **Expo SecureStore** | Secure token storage |

## Project Structure

```
mobile/
├── App.tsx                 # Entry point
├── app.json                # Expo configuration
├── index.ts                # Registration
├── src/
│   ├── screens/            # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── RecipeScreen.tsx
│   │   └── ...
│   ├── components/         # Shared components
│   │   ├── RecipeCard.tsx
│   │   ├── Button.tsx
│   │   └── ...
│   ├── navigation/         # React Navigation setup
│   │   ├── AppNavigator.tsx
│   │   └── types.ts
│   ├── store/              # Zustand state
│   │   └── useStore.ts
│   ├── lib/                # Utilities
│   │   ├── api.ts          # Axios client
│   │   └── storage.ts      # SecureStore helpers
│   └── types/              # TypeScript types
├── assets/                 # Images, fonts
├── tailwind.config.js      # NativeWind config
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

### API URL

Update the backend URL in `src/lib/api.ts`:

```typescript
const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api'  // Development
  : 'https://potatoes-backend.fly.dev/api';  // Production
```

For physical device testing, use your computer's local IP:
```typescript
const API_BASE_URL = 'http://192.168.1.100:8000/api';
```

### app.json

```json
{
  "expo": {
    "name": "Potatoes",
    "slug": "potatoes",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#F59E0B"
    },
    "ios": {
      "bundleIdentifier": "com.potatoes.app"
    },
    "android": {
      "package": "com.potatoes.app"
    }
  }
}
```

## Key Dependencies

```json
{
  "dependencies": {
    "expo": "~54.0.30",
    "react-native": "0.81.5",
    "@react-navigation/native": "^7.1.26",
    "@react-navigation/native-stack": "^7.9.0",
    "@react-navigation/bottom-tabs": "^7.9.0",
    "zustand": "^5.0.9",
    "axios": "^1.13.2",
    "nativewind": "^4.2.1",
    "expo-secure-store": "~15.0.8",
    "expo-image": "~3.0.11",
    "expo-image-picker": "~17.0.10",
    "expo-haptics": "~15.0.8"
  }
}
```

## Navigation

Using React Navigation with stack and tab navigators:

```typescript
// AppNavigator.tsx
function AppNavigator() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <MainTabs />  // Bottom tab navigator
      ) : (
        <AuthStack />  // Login/Register screens
      )}
    </NavigationContainer>
  );
}
```

### Tab Structure

| Tab | Screen | Icon |
|-----|--------|------|
| Home | Recipe feed | Home |
| Search | Search recipes/users | Search |
| Add | Create recipe | Plus |
| Plan | Meal planning | Calendar |
| Profile | User profile | Person |

## State Management

Zustand store mirrors the web frontend:

```typescript
// src/store/useStore.ts
interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync('accessToken', access);
    await SecureStore.setItemAsync('refreshToken', refresh);
    set({ token: access, refreshToken: refresh, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },
}));
```

## Secure Storage

Using Expo SecureStore for sensitive data:

```typescript
import * as SecureStore from 'expo-secure-store';

// Store token
await SecureStore.setItemAsync('accessToken', token);

// Retrieve token
const token = await SecureStore.getItemAsync('accessToken');

// Delete token
await SecureStore.deleteItemAsync('accessToken');
```

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

## API Client

Axios instance with auth interceptor:

```typescript
// src/lib/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
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
- Shake device → "Reload"
- Press `r` in terminal

### Debugging

```bash
# Open React DevTools
npx react-devtools
```

Or use Expo's built-in debugger (shake device → "Debug Remote JS").

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

## Future Improvements

- [ ] Push notifications (Expo Notifications)
- [ ] Offline support (local database)
- [ ] Deep linking
- [ ] Biometric authentication
- [ ] Share extension
