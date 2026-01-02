import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, RecipeSummary, Collection, UserSearchResult } from '@/types';
import { useStore } from '@/store/useStore';
import { recipeApi, collectionApi, socialApi } from '@/lib/api';
import UserAvatar from '@/components/ui/UserAvatar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'collections' | 'followers' | 'following';

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useStore();

  const [activeTab, setActiveTab] = useState<TabType>('collections');
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [followers, setFollowers] = useState<UserSearchResult[]>([]);
  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [requests, setRequests] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [recipesRes, collectionsRes, followersRes, followingRes, requestsRes] = await Promise.all([
        recipeApi.list({ page: 1, page_size: 50 }),
        collectionApi.list(),
        socialApi.getFollowers(),
        socialApi.getFollowing(),
        socialApi.getFollowRequests(),
      ]);
      setRecipes(recipesRes.items);
      setCollections(collectionsRes);
      setFollowers(followersRes);
      setFollowing(followingRes);
      setRequests(requestsRes);
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleFollowAction = async (userId: string, action: 'accept' | 'decline') => {
    try {
      if (action === 'accept') {
        await socialApi.acceptFollowRequest(userId);
      } else {
        await socialApi.declineFollowRequest(userId);
      }
      loadData();
    } catch (err) {
      console.error('Failed to handle follow request:', err);
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      await socialApi.unfollow(userId);
      setFollowing(following.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Failed to unfollow:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'collections', label: 'Collections', count: collections.length },
    { id: 'followers', label: 'Followers', count: followers.length + requests.length },
    { id: 'following', label: 'Following', count: following.length },
  ];

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C6A664"
            colors={['#C6A664']}
          />
        }
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
                <Text className="text-2xl font-semibold text-charcoal">
                  {recipes.length}
                </Text>
                <Text className="text-warm-gray text-sm">Recipes</Text>
              </View>
              <View className="w-px bg-border" />
              <TouchableOpacity
                onPress={() => setActiveTab('followers')}
                className="items-center px-6"
                activeOpacity={0.7}
              >
                <Text className="text-2xl font-semibold text-charcoal">
                  {followers.length}
                </Text>
                <Text className="text-warm-gray text-sm">Followers</Text>
              </TouchableOpacity>
              <View className="w-px bg-border" />
              <TouchableOpacity
                onPress={() => setActiveTab('following')}
                className="items-center px-6"
                activeOpacity={0.7}
              >
                <Text className="text-2xl font-semibold text-charcoal">
                  {following.length}
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

        {/* Tabs */}
        <View className="flex-row border-b border-border mx-4">
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 items-center relative ${
                activeTab === tab.id ? '' : ''
              }`}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className={`text-sm font-medium ${
                  activeTab === tab.id ? 'text-gold' : 'text-warm-gray'
                }`}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View className={`ml-1.5 px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-gold/10' : 'bg-cream-dark'
                  }`}>
                    <Text className={`text-xs ${
                      activeTab === tab.id ? 'text-gold' : 'text-warm-gray'
                    }`}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </View>
              {activeTab === tab.id && (
                <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View className="p-4">
          {loading ? (
            <View className="items-center py-8">
              <Text className="text-warm-gray">Loading...</Text>
            </View>
          ) : (
            <>
              {/* Collections Tab */}
              {activeTab === 'collections' && (
                collections.length === 0 ? (
                  <View className="bg-white rounded-xl p-8 items-center border border-border">
                    <Ionicons name="folder-outline" size={48} color="#9A948D" />
                    <Text className="text-warm-gray mt-2">No collections yet</Text>
                    <TouchableOpacity className="mt-4 bg-gold px-6 py-3 rounded-full">
                      <Text className="text-white font-medium">Create Your First Collection</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="space-y-3">
                    {collections.map(collection => (
                      <TouchableOpacity
                        key={collection.id}
                        onPress={() => navigation.navigate('CollectionDetail', { id: collection.id })}
                        className="bg-white rounded-xl border border-border overflow-hidden"
                        activeOpacity={0.7}
                      >
                        <View className="h-24 bg-cream-dark">
                          {collection.cover_image_url ? (
                            <Image
                              source={{ uri: collection.cover_image_url }}
                              className="w-full h-full"
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="w-full h-full items-center justify-center">
                              <Ionicons name="folder-outline" size={32} color="#9A948D" />
                            </View>
                          )}
                        </View>
                        <View className="p-4">
                          <Text className="font-medium text-charcoal">{collection.name}</Text>
                          {collection.description && (
                            <Text className="text-sm text-warm-gray mt-1" numberOfLines={2}>
                              {collection.description}
                            </Text>
                          )}
                          <Text className="text-xs text-warm-gray mt-2">
                            {collection.recipe_count || 0} recipes
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}

              {/* Followers Tab */}
              {activeTab === 'followers' && (
                requests.length === 0 && followers.length === 0 ? (
                  <View className="bg-white rounded-xl p-8 items-center border border-border">
                    <Ionicons name="people-outline" size={48} color="#9A948D" />
                    <Text className="text-warm-gray mt-2">No followers yet</Text>
                  </View>
                ) : (
                  <View className="space-y-3">
                    {/* Pending Requests */}
                    {requests.length > 0 && (
                      <View>
                        <Text className="text-sm font-medium text-charcoal mb-2">
                          Pending Requests ({requests.length})
                        </Text>
                        <View className="bg-white rounded-xl border border-gold/30 overflow-hidden">
                          {requests.map((reqUser, index) => (
                            <View
                              key={reqUser.id}
                              className={`p-4 flex-row items-center justify-between bg-gold/5 ${
                                index < requests.length - 1 ? 'border-b border-border' : ''
                              }`}
                            >
                              <TouchableOpacity
                                onPress={() => navigation.navigate('UserProfile', { userId: reqUser.id })}
                                className="flex-row items-center flex-1"
                              >
                                <UserAvatar user={reqUser} size="md" />
                                <Text className="font-medium text-charcoal ml-3">{reqUser.name}</Text>
                              </TouchableOpacity>
                              <View className="flex-row gap-2">
                                <TouchableOpacity
                                  onPress={() => handleFollowAction(reqUser.id, 'accept')}
                                  className="px-3 py-1.5 bg-gold rounded-lg"
                                >
                                  <Text className="text-sm text-white">Accept</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleFollowAction(reqUser.id, 'decline')}
                                  className="px-3 py-1.5 border border-border rounded-lg"
                                >
                                  <Text className="text-sm text-warm-gray">Decline</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Confirmed Followers */}
                    {followers.length > 0 && (
                      <View>
                        {requests.length > 0 && (
                          <Text className="text-sm font-medium text-charcoal mb-2">
                            Followers ({followers.length})
                          </Text>
                        )}
                        <View className="bg-white rounded-xl border border-border overflow-hidden">
                          {followers.map((follower, index) => (
                            <TouchableOpacity
                              key={follower.id}
                              onPress={() => navigation.navigate('UserProfile', { userId: follower.id })}
                              className={`p-4 flex-row items-center ${
                                index < followers.length - 1 ? 'border-b border-border' : ''
                              }`}
                              activeOpacity={0.7}
                            >
                              <UserAvatar user={follower} size="md" />
                              <Text className="font-medium text-charcoal ml-3 flex-1">{follower.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )
              )}

              {/* Following Tab */}
              {activeTab === 'following' && (
                following.length === 0 ? (
                  <View className="bg-white rounded-xl p-8 items-center border border-border">
                    <Ionicons name="people-outline" size={48} color="#9A948D" />
                    <Text className="text-warm-gray mt-2">You're not following anyone yet</Text>
                  </View>
                ) : (
                  <View className="bg-white rounded-xl border border-border overflow-hidden">
                    {following.map((followedUser, index) => (
                      <View
                        key={followedUser.id}
                        className={`p-4 flex-row items-center justify-between ${
                          index < following.length - 1 ? 'border-b border-border' : ''
                        }`}
                      >
                        <TouchableOpacity
                          onPress={() => navigation.navigate('UserProfile', { userId: followedUser.id })}
                          className="flex-row items-center flex-1"
                          activeOpacity={0.7}
                        >
                          <UserAvatar user={followedUser} size="md" />
                          <Text className="font-medium text-charcoal ml-3">{followedUser.name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleUnfollow(followedUser.id)}
                          className="px-3 py-1.5 border border-border rounded-lg"
                        >
                          <Text className="text-sm text-warm-gray">Unfollow</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )
              )}
            </>
          )}
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
