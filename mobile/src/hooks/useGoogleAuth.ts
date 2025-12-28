import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useStore } from '@/store/useStore';
import { initializeAuth } from '@/lib/api';

// Complete the auth session to dismiss the web browser
WebBrowser.maybeCompleteAuthSession();

// You'll need to set these up in Google Cloud Console
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';

export function useGoogleAuth() {
  const { setTokens, fetchUserProfile } = useStore();

  const redirectUri = makeRedirectUri({
    scheme: 'potatoes',
    path: 'auth/callback',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    webClientId: GOOGLE_CLIENT_ID_WEB,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    handleGoogleResponse();
  }, [response]);

  async function handleGoogleResponse() {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        try {
          // Send the Google access token to your backend
          // Your backend should exchange it for your own JWT tokens
          const backendResponse = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL || 'https://potatoes-backend.fly.dev/api'}/auth/google/mobile`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                access_token: authentication.accessToken,
                id_token: authentication.idToken,
              }),
            }
          );

          if (!backendResponse.ok) {
            throw new Error('Failed to authenticate with backend');
          }

          const data = await backendResponse.json();
          await setTokens(data.access_token, data.refresh_token, data.expires_in);
          await initializeAuth();
          await fetchUserProfile();
        } catch (error) {
          console.error('Google auth failed:', error);
          throw error;
        }
      }
    }
  }

  const signInWithGoogle = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  return {
    signInWithGoogle,
    isLoading: !request,
  };
}
