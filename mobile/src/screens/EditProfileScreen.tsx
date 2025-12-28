import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { RootStackParamList } from '@/types';
import { useStore } from '@/store/useStore';
import { getErrorMessage } from '@/lib/api';
import { useImagePicker } from '@/hooks/useImagePicker';
import UserAvatar from '@/components/ui/UserAvatar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EditProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile } = useStore();
  const { image, showImageOptions, clearImage, loading: imageLoading } = useImagePicker({
    aspect: [1, 1],
    quality: 0.8,
  });

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);

  // Track if there are unsaved changes
  const hasChanges = name !== (user?.name || '') || bio !== (user?.bio || '') || !!image;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        bio: bio.trim() || undefined,
        // Note: Image upload would require a separate upload endpoint
        // For now, we just save name and bio
      });
      Alert.alert('Success', 'Profile updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-cream"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-border">
        <TouchableOpacity onPress={handleCancel} className="p-2 -ml-2">
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-charcoal">Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !hasChanges}
          className="p-2 -mr-2"
        >
          <Text className={`font-semibold ${
            saving || !hasChanges ? 'text-warm-gray' : 'text-gold'
          }`}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Image */}
        <View className="items-center py-6">
          <TouchableOpacity onPress={showImageOptions} activeOpacity={0.8}>
            <View className="relative">
              {image ? (
                <Image
                  source={{ uri: image }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                  contentFit="cover"
                />
              ) : (
                <UserAvatar user={user} size="xl" />
              )}
              <View className="absolute bottom-0 right-0 w-8 h-8 bg-gold rounded-full items-center justify-center border-2 border-white">
                <Ionicons name="camera" size={16} color="white" />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={showImageOptions} className="mt-2">
            <Text className="text-gold font-medium">Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View className="px-4">
          <View className="bg-white rounded-xl border border-border overflow-hidden">
            {/* Name */}
            <View className="px-4 py-3 border-b border-border">
              <Text className="text-xs text-warm-gray uppercase tracking-wide mb-1">Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#9A948D"
                className="text-charcoal text-base py-1"
                autoCapitalize="words"
              />
            </View>

            {/* Bio */}
            <View className="px-4 py-3">
              <Text className="text-xs text-warm-gray uppercase tracking-wide mb-1">Bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor="#9A948D"
                className="text-charcoal text-base py-1"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 80 }}
              />
            </View>
          </View>

          {/* Email (read-only) */}
          <View className="mt-4 bg-white rounded-xl border border-border overflow-hidden">
            <View className="px-4 py-3">
              <Text className="text-xs text-warm-gray uppercase tracking-wide mb-1">Email</Text>
              <Text className="text-charcoal text-base py-1">{user?.email}</Text>
            </View>
          </View>

          <Text className="text-xs text-warm-gray mt-2 px-1">
            Email cannot be changed from the app
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
