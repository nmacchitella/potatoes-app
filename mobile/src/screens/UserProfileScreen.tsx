import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, UserProfilePublic, RecipeSummary } from '@/types';
import { socialApi, getErrorMessage } from '@/lib/api';
import UserAvatar from '@/components/ui/UserAvatar';
import RecipeCard from '@/components/recipes/RecipeCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<UserProfileRouteProp>();
  const insets = useSafeAreaInsets();
  const { userId } = route.params;

  const [profile, setProfile] = useState<UserProfilePublic | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const [profileData, recipesData] = await Promise.all([
        socialApi.getUserProfile(userId),
        socialApi.getUserRecipes(userId),
      ]);
      setProfile(profileData);
      setRecipes(recipesData.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollow = async () => {
    if (!profile) return;

    setFollowLoading(true);
    try {
      if (profile.is_followed_by_me) {
        await socialApi.unfollow(userId);
        setProfile({ ...profile, is_followed_by_me: false, follower_count: profile.follower_count - 1 });
      } else {
        const response = await socialApi.follow(userId);
        setProfile({
          ...profile,
          is_followed_by_me: true,
          follow_status: response.status,
          follower_count: response.status === 'confirmed' ? profile.follower_count + 1 : profile.follower_count,
        });
      }
    } catch (error) {
      console.error('Follow action failed:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator size="large" color="#C6A664" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-cream px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#6B6560" />
        <Text className="text-warm-gray text-center mt-4">{error || 'User not found'}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-6 bg-gold px-6 py-3 rounded-full"
        >
          <Text className="text-white font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getFollowButtonText = () => {
    if (profile.is_followed_by_me) {
      if (profile.follow_status === 'pending') return 'Requested';
      return 'Following';
    }
    return 'Follow';
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
        <Text className="text-xl font-semibold text-charcoal">{profile.name}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Profile Card */}
        <View className="p-4">
          <View className="bg-white rounded-xl p-6 items-center border border-border">
            <UserAvatar user={profile as any} size="xl" />
            <Text className="text-xl font-semibold text-charcoal mt-4">
              {profile.name}
            </Text>
            {profile.bio && (
              <Text className="text-warm-gray text-center mt-2">{profile.bio}</Text>
            )}

            {/* Stats */}
            <View className="flex-row mt-6">
              <View className="items-center px-6">
                <Text className="text-2xl font-semibold text-charcoal">
                  {recipes.length}
                </Text>
                <Text className="text-warm-gray text-sm">Recipes</Text>
              </View>
              <View className="w-px bg-border" />
              <View className="items-center px-6">
                <Text className="text-2xl font-semibold text-charcoal">
                  {profile.follower_count}
                </Text>
                <Text className="text-warm-gray text-sm">Followers</Text>
              </View>
              <View className="w-px bg-border" />
              <View className="items-center px-6">
                <Text className="text-2xl font-semibold text-charcoal">
                  {profile.following_count}
                </Text>
                <Text className="text-warm-gray text-sm">Following</Text>
              </View>
            </View>

            {/* Follow Button */}
            <TouchableOpacity
              onPress={handleFollow}
              disabled={followLoading}
              className={`mt-6 px-8 py-3 rounded-full ${
                profile.is_followed_by_me ? 'bg-cream border border-border' : 'bg-gold'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`font-medium ${
                  profile.is_followed_by_me ? 'text-charcoal' : 'text-white'
                }`}
              >
                {followLoading ? 'Loading...' : getFollowButtonText()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipes */}
        <View className="px-4">
          <Text className="text-charcoal font-semibold text-lg mb-3">
            Recipes
          </Text>
          {recipes.length === 0 ? (
            <View className="bg-white rounded-xl p-8 items-center border border-border">
              <Ionicons name="restaurant-outline" size={48} color="#9A948D" />
              <Text className="text-warm-gray mt-2">No recipes yet</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap -mx-1">
              {recipes.map((recipe) => (
                <View key={recipe.id} className="w-1/2 px-1 mb-2">
                  <RecipeCard
                    recipe={recipe}
                    onPress={() =>
                      navigation.navigate('RecipeDetail', { id: recipe.id })
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
