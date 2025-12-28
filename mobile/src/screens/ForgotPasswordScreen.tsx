import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '@/types';
import { authApi, getErrorMessage } from '@/lib/api';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-cream"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-1 px-6">
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center py-4"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          <Text className="text-charcoal ml-2">Back to Login</Text>
        </TouchableOpacity>

        <View className="flex-1 justify-center">
          {sent ? (
            // Success State
            <View className="items-center">
              <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
              </View>
              <Text className="text-2xl font-bold text-charcoal text-center mb-3">
                Check your email
              </Text>
              <Text className="text-warm-gray text-center mb-8 px-4">
                We've sent password reset instructions to{'\n'}
                <Text className="font-medium text-charcoal">{email}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                className="bg-gold py-4 px-8 rounded-xl"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-lg">
                  Back to Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSent(false)}
                className="mt-4"
                activeOpacity={0.7}
              >
                <Text className="text-gold">Didn't receive email? Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Form State
            <>
              <View className="items-center mb-8">
                <View className="w-20 h-20 bg-gold/10 rounded-2xl items-center justify-center mb-4">
                  <Ionicons name="lock-open-outline" size={40} color="#C6A664" />
                </View>
                <Text className="text-2xl font-bold text-charcoal">Reset Password</Text>
                <Text className="text-warm-gray mt-2 text-center px-4">
                  Enter your email and we'll send you instructions to reset your password
                </Text>
              </View>

              <View className="bg-white rounded-2xl p-6 border border-border">
                {/* Email */}
                <View className="mb-6">
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
                      autoFocus
                      className="flex-1 py-4 ml-3 text-charcoal"
                    />
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  className={`py-4 rounded-xl items-center ${
                    loading ? 'bg-gold-light' : 'bg-gold'
                  }`}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-lg">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
