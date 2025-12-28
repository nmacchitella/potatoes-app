import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, UserSearchResult } from '@/types';
import { socialApi } from '@/lib/api';
import UserAvatar from '@/components/ui/UserAvatar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'FollowList'>;

export default function FollowListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { userId, mode } = route.params;

  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = mode === 'followers'
        ? await socialApi.getFollowers()
        : await socialApi.getFollowing();
      setUsers(data);
    } catch (error) {
      console.error(`Failed to fetch ${mode}:`, error);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const title = mode === 'followers' ? 'Followers' : 'Following';

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
        <Text className="text-xl font-semibold text-charcoal">{title}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C6A664" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C6A664"
              colors={['#C6A664']}
            />
          }
        >
          {users.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="people-outline" size={48} color="#9A948D" />
              <Text className="text-warm-gray mt-4">
                {mode === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
              </Text>
            </View>
          ) : (
            <View className="py-2">
              {users.map(user => (
                <TouchableOpacity
                  key={user.id}
                  onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                  className="flex-row items-center px-4 py-3 bg-white border-b border-border"
                  activeOpacity={0.7}
                >
                  <UserAvatar user={user} size="md" />
                  <View className="ml-3 flex-1">
                    <Text className="text-charcoal font-medium" numberOfLines={1}>
                      {user.name}
                    </Text>
                    {!user.is_public && (
                      <View className="flex-row items-center mt-0.5">
                        <Ionicons name="lock-closed" size={12} color="#6B6560" />
                        <Text className="text-warm-gray text-xs ml-1">Private account</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9A948D" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
