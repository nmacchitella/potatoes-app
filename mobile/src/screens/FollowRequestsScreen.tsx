import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, UserSearchResult } from '@/types';
import { socialApi, getErrorMessage } from '@/lib/api';
import UserAvatar from '@/components/ui/UserAvatar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FollowRequestsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await socialApi.getFollowRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch follow requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [fetchRequests]);

  const handleAccept = async (userId: string) => {
    setProcessing(userId);
    try {
      await socialApi.acceptFollowRequest(userId);
      setRequests(prev => prev.filter(r => r.id !== userId));
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (userId: string) => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this follow request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessing(userId);
            try {
              await socialApi.declineFollowRequest(userId);
              setRequests(prev => prev.filter(r => r.id !== userId));
            } catch (error) {
              Alert.alert('Error', getErrorMessage(error));
            } finally {
              setProcessing(null);
            }
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
        <Text className="text-xl font-semibold text-charcoal">Follow Requests</Text>
        {requests.length > 0 && (
          <View className="ml-2 bg-gold rounded-full px-2 py-0.5">
            <Text className="text-white text-xs font-medium">{requests.length}</Text>
          </View>
        )}
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
          {requests.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="people-outline" size={48} color="#9A948D" />
              <Text className="text-warm-gray mt-4">No pending follow requests</Text>
            </View>
          ) : (
            <View className="py-2">
              {requests.map(user => {
                const isProcessing = processing === user.id;

                return (
                  <View
                    key={user.id}
                    className="flex-row items-center px-4 py-3 bg-white border-b border-border"
                  >
                    <TouchableOpacity
                      onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                      className="flex-row items-center flex-1"
                    >
                      <UserAvatar user={user} size="md" />
                      <View className="ml-3 flex-1">
                        <Text className="text-charcoal font-medium" numberOfLines={1}>
                          {user.name}
                        </Text>
                        {!user.is_public && (
                          <View className="flex-row items-center mt-0.5">
                            <Ionicons name="lock-closed" size={12} color="#6B6560" />
                            <Text className="text-warm-gray text-xs ml-1">Private</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Action Buttons */}
                    <View className="flex-row items-center gap-2 ml-2">
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#C6A664" />
                      ) : (
                        <>
                          <TouchableOpacity
                            onPress={() => handleAccept(user.id)}
                            className="bg-gold px-4 py-2 rounded-full"
                          >
                            <Text className="text-white font-medium text-sm">Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDecline(user.id)}
                            className="bg-cream-dark px-4 py-2 rounded-full"
                          >
                            <Text className="text-warm-gray font-medium text-sm">Decline</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
