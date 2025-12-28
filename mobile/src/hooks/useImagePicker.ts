import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { recipeApi, getErrorMessage } from '@/lib/api';

interface UseImagePickerOptions {
  aspect?: [number, number];
  quality?: number;
  allowsEditing?: boolean;
  recipeId?: string; // If provided, uploads immediately after picking
}

export function useImagePicker(options: UseImagePickerOptions = {}) {
  const [image, setImage] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null); // Local file URI before upload
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { aspect = [16, 9], quality = 0.8, allowsEditing = true, recipeId } = options;

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera and photo library access to upload images.'
        );
        return false;
      }
    }
    return true;
  };

  const uploadToCloudinary = async (uri: string): Promise<string | null> => {
    if (!recipeId) {
      // No recipe ID - store locally and return local URI
      setLocalUri(uri);
      setImage(uri);
      return uri;
    }

    setUploading(true);
    try {
      const result = await recipeApi.uploadImage(recipeId, uri);
      setImage(result.url);
      setLocalUri(null);
      return result.url;
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', getErrorMessage(error, 'Failed to upload image'));
      // Keep local URI as fallback
      setLocalUri(uri);
      setImage(uri);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing,
        aspect,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setLoading(false);
        return uploadToCloudinary(uri);
      }
      return null;
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing,
        aspect,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setLoading(false);
        return uploadToCloudinary(uri);
      }
      return null;
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Upload a pending local image (for new recipes after they're created)
  const uploadPendingImage = async (newRecipeId: string): Promise<string | null> => {
    if (!localUri) return image;

    setUploading(true);
    try {
      const result = await recipeApi.uploadImage(newRecipeId, localUri);
      setImage(result.url);
      setLocalUri(null);
      return result.url;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const clearImage = () => {
    setImage(null);
    setLocalUri(null);
  };

  return {
    image,
    localUri,
    loading,
    uploading,
    pickFromLibrary,
    takePhoto,
    showImageOptions,
    clearImage,
    setImage,
    uploadPendingImage,
    hasLocalImage: !!localUri,
  };
}
