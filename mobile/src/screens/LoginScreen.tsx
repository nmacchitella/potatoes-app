import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '@/types';
import { useStore } from '@/store/useStore';
import { authApi, getErrorMessage, setAuthHeader } from '@/lib/api';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { setTokens, fetchUserProfile } = useStore();
  const { signInWithGoogle, isLoading: googleLoading } = useGoogleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      await setTokens(response.access_token, response.refresh_token, response.expires_in);
      setAuthHeader(response.access_token, response.expires_in);
      await fetchUserProfile();
    } catch (error) {
      Alert.alert('Login Failed', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert('Google Login Failed', getErrorMessage(error));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-cream"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo/Title */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-gold rounded-2xl items-center justify-center mb-4">
            <Ionicons name="restaurant" size={40} color="white" />
          </View>
          <Text className="text-3xl font-bold text-charcoal">Potatoes</Text>
          <Text className="text-warm-gray mt-2">Welcome back!</Text>
        </View>

        {/* Form */}
        <View className="bg-white rounded-2xl p-6 border border-border">
          {/* Email */}
          <View className="mb-4">
            <Text className="text-charcoal font-medium mb-2">Email</Text>
            <View className="flex-row items-center bg-cream rounded-lg px-4">
              <Ionicons name="mail-outline" size={20} color="#6B6560" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#9A948D"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="flex-1 py-4 ml-3 text-charcoal"
              />
            </View>
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-charcoal font-medium mb-2">Password</Text>
            <View className="flex-row items-center bg-cream rounded-lg px-4">
              <Ionicons name="lock-closed-outline" size={20} color="#6B6560" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#9A948D"
                secureTextEntry={!showPassword}
                autoComplete="password"
                className="flex-1 py-4 ml-3 text-charcoal"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6B6560"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className={`py-4 rounded-xl items-center ${
              loading ? 'bg-gold-light' : 'bg-gold'
            }`}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-lg">
              {loading ? 'Logging in...' : 'Log In'}
            </Text>
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            className="mt-4 items-center"
            activeOpacity={0.7}
          >
            <Text className="text-gold">Forgot password?</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-warm-gray text-sm mx-4">or continue with</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="flex-row items-center justify-center py-4 rounded-xl border border-border bg-white"
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text className="text-charcoal font-medium ml-3">
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>

        {/* Register Link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-warm-gray">Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text className="text-gold font-medium">Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
