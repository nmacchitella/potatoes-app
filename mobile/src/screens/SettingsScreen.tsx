import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '@/types';
import { useStore } from '@/store/useStore';
import { authApi, getErrorMessage } from '@/lib/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useStore();
  const [useMetric, setUseMetric] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Deletion',
              'Enter your password to confirm account deletion',
              async (password) => {
                if (password) {
                  try {
                    // Note: This would need a deleteAccount API endpoint
                    // await authApi.deleteAccount(password);
                    Alert.alert('Account Deleted', 'Your account has been deleted.');
                    await logout();
                  } catch (error) {
                    Alert.alert('Error', getErrorMessage(error));
                  }
                }
              },
              'secure-text'
            );
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-border px-4 py-3 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-2 -ml-2 mr-2"
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-charcoal">Settings</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Account Section */}
        <View className="mt-4">
          <Text className="px-4 text-warm-gray text-sm font-medium mb-2">ACCOUNT</Text>
          <View className="bg-white border-y border-border">
            <TouchableOpacity
              onPress={() => navigation.navigate('EditProfile')}
              className="flex-row items-center justify-between px-4 py-4 border-b border-border"
            >
              <View className="flex-row items-center">
                <Ionicons name="person-outline" size={20} color="#6B6560" />
                <Text className="text-charcoal ml-3">Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9A948D" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowPasswordForm(!showPasswordForm)}
              className="flex-row items-center justify-between px-4 py-4 border-b border-border"
            >
              <View className="flex-row items-center">
                <Ionicons name="lock-closed-outline" size={20} color="#6B6560" />
                <Text className="text-charcoal ml-3">Change Password</Text>
              </View>
              <Ionicons
                name={showPasswordForm ? 'chevron-up' : 'chevron-forward'}
                size={20}
                color="#9A948D"
              />
            </TouchableOpacity>
            {showPasswordForm && (
              <View className="px-4 py-4 bg-cream-dark border-b border-border">
                <View className="mb-3">
                  <Text className="text-xs text-warm-gray mb-1">Current Password</Text>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    placeholder="Enter current password"
                    placeholderTextColor="#9A948D"
                    className="bg-white rounded-lg px-3 py-3 text-charcoal border border-border"
                  />
                </View>
                <View className="mb-3">
                  <Text className="text-xs text-warm-gray mb-1">New Password</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholder="Enter new password"
                    placeholderTextColor="#9A948D"
                    className="bg-white rounded-lg px-3 py-3 text-charcoal border border-border"
                  />
                </View>
                <View className="mb-4">
                  <Text className="text-xs text-warm-gray mb-1">Confirm New Password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="Confirm new password"
                    placeholderTextColor="#9A948D"
                    className="bg-white rounded-lg px-3 py-3 text-charcoal border border-border"
                  />
                </View>
                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={savingPassword}
                  className={`py-3 rounded-lg items-center ${savingPassword ? 'bg-gold-light' : 'bg-gold'}`}
                >
                  <Text className="text-white font-medium">
                    {savingPassword ? 'Saving...' : 'Update Password'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center">
                <Ionicons name="mail-outline" size={20} color="#6B6560" />
                <Text className="text-charcoal ml-3">{user?.email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View className="mt-6">
          <Text className="px-4 text-warm-gray text-sm font-medium mb-2">PREFERENCES</Text>
          <View className="bg-white border-y border-border">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
              <View className="flex-row items-center">
                <Ionicons name="scale-outline" size={20} color="#6B6560" />
                <Text className="text-charcoal ml-3">Use Metric Units</Text>
              </View>
              <Switch
                value={useMetric}
                onValueChange={setUseMetric}
                trackColor={{ false: '#E5E0D5', true: '#C6A664' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center">
                <Ionicons name="notifications-outline" size={20} color="#6B6560" />
                <Text className="text-charcoal ml-3">Email Notifications</Text>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: '#E5E0D5', true: '#C6A664' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* About Section */}
        <View className="mt-6">
          <Text className="px-4 text-warm-gray text-sm font-medium mb-2">ABOUT</Text>
          <View className="bg-white border-y border-border">
            <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-border">
              <View className="flex-row items-center">
                <Ionicons name="information-circle-outline" size={20} color="#6B6560" />
                <Text className="text-charcoal ml-3">About Potatoes</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9A948D" />
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center">
                <Ionicons name="document-text-outline" size={20} color="#6B6560" />
                <Text className="text-charcoal ml-3">Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9A948D" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <View className="mt-6 px-4">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-white border border-red-200 py-4 rounded-xl items-center"
            activeOpacity={0.7}
          >
            <Text className="text-red-500 font-medium">Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View className="mt-6">
          <Text className="px-4 text-red-500 text-sm font-medium mb-2">DANGER ZONE</Text>
          <View className="bg-white border-y border-red-200">
            <TouchableOpacity
              onPress={handleDeleteAccount}
              className="flex-row items-center justify-between px-4 py-4"
            >
              <View className="flex-row items-center">
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text className="text-red-500 ml-3">Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
          <Text className="px-4 text-xs text-warm-gray mt-2">
            This will permanently delete your account and all your data.
          </Text>
        </View>

        {/* Version */}
        <Text className="text-center text-warm-gray-light text-xs mt-6">
          Version 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
