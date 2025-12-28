import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '@/types';
import { authApi, getErrorMessage } from '@/lib/api';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({ name, email, password });
      Alert.alert(
        'Account Created',
        'Please check your email to verify your account, then log in.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Registration Failed', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-cream"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View className="px-6">
          {/* Header */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-gold rounded-2xl items-center justify-center mb-4">
              <Ionicons name="restaurant" size={40} color="white" />
            </View>
            <Text className="text-3xl font-bold text-charcoal">Create Account</Text>
            <Text className="text-warm-gray mt-2">Join the Potatoes community</Text>
          </View>

          {/* Form */}
          <View className="bg-white rounded-2xl p-6 border border-border">
            {/* Name */}
            <View className="mb-4">
              <Text className="text-charcoal font-medium mb-2">Name</Text>
              <View className="flex-row items-center bg-cream rounded-lg px-4">
                <Ionicons name="person-outline" size={20} color="#6B6560" />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="#9A948D"
                  autoCapitalize="words"
                  autoComplete="name"
                  className="flex-1 py-4 ml-3 text-charcoal"
                />
              </View>
            </View>

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
            <View className="mb-4">
              <Text className="text-charcoal font-medium mb-2">Password</Text>
              <View className="flex-row items-center bg-cream rounded-lg px-4">
                <Ionicons name="lock-closed-outline" size={20} color="#6B6560" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (min 8 characters)"
                  placeholderTextColor="#9A948D"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
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

            {/* Confirm Password */}
            <View className="mb-6">
              <Text className="text-charcoal font-medium mb-2">Confirm Password</Text>
              <View className="flex-row items-center bg-cream rounded-lg px-4">
                <Ionicons name="lock-closed-outline" size={20} color="#6B6560" />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor="#9A948D"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  className="flex-1 py-4 ml-3 text-charcoal"
                />
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              className={`py-4 rounded-xl items-center ${
                loading ? 'bg-gold-light' : 'bg-gold'
              }`}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold text-lg">
                {loading ? 'Creating account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-warm-gray">Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text className="text-gold font-medium">Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
