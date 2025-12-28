import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '@/types';
import { useStore } from '@/store/useStore';
import UserAvatar from '@/components/ui/UserAvatar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useStore();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
      >
        {/* Header */}
        <View className="px-4 py-4 flex-row items-center justify-between border-b border-border bg-white">
          <Text className="text-2xl font-semibold text-charcoal">Profile</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            className="p-2"
          >
            <Ionicons name="settings-outline" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View className="p-4">
          <View className="bg-white rounded-xl p-6 items-center border border-border">
            <UserAvatar user={user} size="xl" />
            <Text className="text-xl font-semibold text-charcoal mt-4">
              {user?.name || 'User'}
            </Text>
            {user?.bio && (
              <Text className="text-warm-gray text-center mt-2">{user.bio}</Text>
            )}

            {/* Stats */}
            <View className="flex-row mt-6">
              <View className="items-center px-6">
                <Text className="text-2xl font-semibold text-charcoal">0</Text>
                <Text className="text-warm-gray text-sm">Recipes</Text>
              </View>
              <View className="w-px bg-border" />
              <TouchableOpacity
                onPress={() => user?.id && navigation.navigate('FollowList', { userId: user.id, mode: 'followers' })}
                className="items-center px-6"
                activeOpacity={0.7}
              >
                <Text className="text-2xl font-semibold text-charcoal">
                  {user?.follower_count || 0}
                </Text>
                <Text className="text-warm-gray text-sm">Followers</Text>
              </TouchableOpacity>
              <View className="w-px bg-border" />
              <TouchableOpacity
                onPress={() => user?.id && navigation.navigate('FollowList', { userId: user.id, mode: 'following' })}
                className="items-center px-6"
                activeOpacity={0.7}
              >
                <Text className="text-2xl font-semibold text-charcoal">
                  {user?.following_count || 0}
                </Text>
                <Text className="text-warm-gray text-sm">Following</Text>
              </TouchableOpacity>
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity
              onPress={() => navigation.navigate('EditProfile')}
              className="mt-6 bg-cream border border-border px-6 py-3 rounded-full"
              activeOpacity={0.7}
            >
              <Text className="text-charcoal font-medium">Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Recipes */}
        <View className="px-4">
          <Text className="text-charcoal font-semibold text-lg mb-3">
            My Recipes
          </Text>
          <View className="bg-white rounded-xl p-8 items-center border border-border">
            <Ionicons name="restaurant-outline" size={48} color="#9A948D" />
            <Text className="text-warm-gray mt-2">No recipes yet</Text>
            <TouchableOpacity className="mt-4 bg-gold px-6 py-3 rounded-full">
              <Text className="text-white font-medium">Create your first recipe</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <View className="p-4 mt-4">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-white border border-red-200 py-4 rounded-xl items-center"
            activeOpacity={0.7}
          >
            <Text className="text-red-500 font-medium">Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
