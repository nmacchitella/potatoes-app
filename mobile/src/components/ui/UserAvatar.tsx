import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@/types';

interface UserAvatarProps {
  user: User | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showFallbackIcon?: boolean;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const textSizeMap = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export default function UserAvatar({
  user,
  size = 'md',
  showFallbackIcon = false,
}: UserAvatarProps) {
  const dimension = sizeMap[size];
  const textSize = textSizeMap[size];

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (user?.profile_image_url) {
    return (
      <Image
        source={{ uri: user.profile_image_url }}
        style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  if (showFallbackIcon && !user) {
    return (
      <View
        className="bg-cream-dark items-center justify-center"
        style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
      >
        <Ionicons name="person" size={dimension * 0.5} color="#6B6560" />
      </View>
    );
  }

  return (
    <View
      className="bg-gold items-center justify-center"
      style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
    >
      <Text className={`text-white font-semibold ${textSize}`}>
        {getInitials(user?.name)}
      </Text>
    </View>
  );
}
