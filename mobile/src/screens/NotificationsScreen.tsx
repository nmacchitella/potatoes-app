import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, Notification } from '@/types';
import { notificationApi } from '@/lib/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationApi.list();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'follow':
      case 'follow_request':
        return 'person-add-outline';
      case 'recipe_saved':
        return 'bookmark-outline';
      default:
        return 'notifications-outline';
    }
  };

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-border px-4 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="p-2 -ml-2 mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-xl font-semibold text-charcoal">Notifications</Text>
        </View>
        {notifications.some(n => !n.is_read) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text className="text-gold">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C6A664" />
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="notifications-outline" size={48} color="#9A948D" />
          <Text className="text-warm-gray text-center mt-4">
            No notifications yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`flex-row items-start px-4 py-4 border-b border-border ${
                !item.is_read ? 'bg-gold/5' : 'bg-white'
              }`}
            >
              <View className={`w-10 h-10 rounded-full items-center justify-center ${
                !item.is_read ? 'bg-gold' : 'bg-cream-dark'
              }`}>
                <Ionicons
                  name={getIcon(item.type) as any}
                  size={20}
                  color={!item.is_read ? 'white' : '#6B6560'}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className={`${!item.is_read ? 'font-semibold' : ''} text-charcoal`}>
                  {item.title}
                </Text>
                <Text className="text-warm-gray text-sm mt-1">{item.message}</Text>
                <Text className="text-warm-gray-light text-xs mt-1">
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              {!item.is_read && (
                <View className="w-2 h-2 bg-gold rounded-full mt-2" />
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
