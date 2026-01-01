import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useStore } from '@/store/useStore';
import { setAuthHeader } from '@/lib/api';

// Configure Google Sign-In on module load
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
});

export function useGoogleAuth() {
  const { setTokens, fetchUserProfile } = useStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleToken = async (googleAccessToken: string) => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://potatoes-backend.fly.dev/api';
    if (__DEV__) console.log('Sending token to backend:', apiUrl);

    const response = await fetch(
      `${apiUrl}/auth/google/mobile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: googleAccessToken }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      throw new Error('Failed to authenticate with backend');
    }

    const data = await response.json();
    await setTokens(data.access_token, data.refresh_token, data.expires_in);
    setAuthHeader(data.access_token, data.expires_in);
    await fetchUserProfile();
  };

  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
      if (__DEV__) console.log('Starting native Google Sign-In');

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      if (__DEV__) console.log('Google Sign-In success, getting tokens');
      const tokens = await GoogleSignin.getTokens();

      if (tokens.accessToken) {
        await handleGoogleToken(tokens.accessToken);
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        if (__DEV__) console.log('User cancelled sign in');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        if (__DEV__) console.log('Sign in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Play services not available');
      } else {
        console.error('Google Sign-In error:', error);
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  }, [setTokens, fetchUserProfile]);

  const signOutFromGoogle = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore Google sign out errors
      if (__DEV__) console.log('Google sign out error (ignored):', e);
    }
  }, []);

  return {
    signInWithGoogle,
    signOutFromGoogle,
    isLoading,
  };
}
