import { View, Text, TouchableOpacity, ScrollView, TextInput, Animated, Alert, Easing } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, Collection, SharedCollection } from '@/types';
import { useStore } from '@/store/useStore';
import { collectionApi, getErrorMessage } from '@/lib/api';
import UserAvatar from '@/components/ui/UserAvatar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PageView = 'recipes' | 'calendar';
type CalendarMode = 'day' | 'week' | 'month';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pageView: PageView;
  onPageViewChange: (view: PageView) => void;
  calendarMode: CalendarMode;
  onCalendarModeChange: (mode: CalendarMode) => void;
  selectedCollection: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
}

export default function MobileSidebar({
  isOpen,
  onClose,
  pageView,
  onPageViewChange,
  calendarMode,
  onCalendarModeChange,
  selectedCollection,
  onCollectionSelect,
}: MobileSidebarProps) {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useStore();

  // Animation
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sharedCollections, setSharedCollections] = useState<SharedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);

  // Inline collection management
  const [isManageMode, setIsManageMode] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCollections();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -300,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const loadCollections = async () => {
    try {
      const [ownCollections, shared] = await Promise.all([
        collectionApi.list(),
        collectionApi.listSharedWithMe(),
      ]);
      setCollections(ownCollections);
      setSharedCollections(shared);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionClick = (collectionId: string | null) => {
    if (isManageMode) return;
    onCollectionSelect(collectionId);
    onClose();
  };

  const handleViewChange = (view: PageView) => {
    onPageViewChange(view);
  };

  const handleCalendarModeChange = (mode: CalendarMode) => {
    onCalendarModeChange(mode);
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleNavClick = (screen: keyof RootStackParamList) => {
    navigation.navigate(screen as any);
    onClose();
  };

  // Collection CRUD
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setSavingCollection(true);
    try {
      const newCollection = await collectionApi.create({ name: newCollectionName.trim() });
      setCollections(prev => [...prev, newCollection]);
      setNewCollectionName('');
      setIsCreatingCollection(false);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setSavingCollection(false);
    }
  };

  const handleUpdateCollection = async (collectionId: string) => {
    if (!editingCollectionName.trim()) return;
    setSavingCollection(true);
    try {
      const updated = await collectionApi.update(collectionId, { name: editingCollectionName.trim() });
      setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, name: updated.name } : c));
      setEditingCollectionId(null);
      setEditingCollectionName('');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setSavingCollection(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    Alert.alert(
      'Delete Collection',
      'Delete this collection? Recipes will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionApi.delete(collectionId);
              setCollections(prev => prev.filter(c => c.id !== collectionId));
              if (selectedCollection === collectionId) {
                onCollectionSelect(null);
              }
            } catch (error) {
              Alert.alert('Error', getErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const startEditingCollection = (collection: Collection) => {
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  };

  if (!isOpen) return null;

  return (
    <View className="absolute inset-0 z-50">
      {/* Backdrop */}
      <Animated.View
        style={{ opacity: fadeAnim }}
        className="absolute inset-0 bg-black/50"
      >
        <TouchableOpacity
          className="flex-1"
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Sidebar */}
      <Animated.View
        style={{ transform: [{ translateX: slideAnim }] }}
        className="absolute top-0 left-0 bottom-0 w-72 bg-cream"
      >
        <View className="flex-1" style={{ paddingTop: insets.top }}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <TouchableOpacity onPress={() => handleCollectionClick(null)}>
              <Text className="text-xl font-bold text-charcoal">Potatoes</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {/* User Profile */}
          <TouchableOpacity
            onPress={() => handleNavClick('EditProfile')}
            className="flex-row items-center gap-3 p-4 border-b border-border"
          >
            <UserAvatar user={user} size="lg" />
            <View className="flex-1 min-w-0">
              <Text className="font-medium text-charcoal" numberOfLines={1}>{user?.name}</Text>
              <Text className="text-sm text-warm-gray">View profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A948D" />
          </TouchableOpacity>

          {/* Scrollable Content */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* View Toggle */}
            <View className="p-4 border-b border-border">
              <View className="flex-row rounded-lg bg-cream-dark p-1">
                <TouchableOpacity
                  onPress={() => handleViewChange('recipes')}
                  className={`flex-1 flex-row items-center justify-center gap-2 px-3 py-2 rounded-md ${
                    pageView === 'recipes' ? 'bg-white' : ''
                  }`}
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={16}
                    color={pageView === 'recipes' ? '#1A1A1A' : '#6B6560'}
                  />
                  <Text className={`text-sm font-medium ${
                    pageView === 'recipes' ? 'text-charcoal' : 'text-warm-gray'
                  }`}>
                    Recipes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleViewChange('calendar')}
                  className={`flex-1 flex-row items-center justify-center gap-2 px-3 py-2 rounded-md ${
                    pageView === 'calendar' ? 'bg-white' : ''
                  }`}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={pageView === 'calendar' ? '#1A1A1A' : '#6B6560'}
                  />
                  <Text className={`text-sm font-medium ${
                    pageView === 'calendar' ? 'text-charcoal' : 'text-warm-gray'
                  }`}>
                    Meal Plan
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Calendar View Options */}
            {pageView === 'calendar' && (
              <View className="p-4 border-b border-border">
                <Text className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-3">
                  Calendar View
                </Text>
                <View className="space-y-1">
                  {[
                    { mode: 'day' as CalendarMode, label: 'Day', icon: 'today-outline' },
                    { mode: 'week' as CalendarMode, label: '3 Days', icon: 'calendar-outline' },
                    { mode: 'month' as CalendarMode, label: 'Month', icon: 'grid-outline' },
                  ].map(({ mode, label, icon }) => (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => handleCalendarModeChange(mode)}
                      className={`flex-row items-center gap-3 px-3 py-2.5 rounded-lg ${
                        calendarMode === mode ? 'bg-gold/10' : ''
                      }`}
                    >
                      <Ionicons
                        name={icon as any}
                        size={20}
                        color={calendarMode === mode ? '#C6A664' : '#6B6560'}
                      />
                      <Text className={`${
                        calendarMode === mode ? 'text-gold-dark font-medium' : 'text-charcoal'
                      }`}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* All Recipes - Only show in recipes view */}
            {pageView === 'recipes' && (
              <View className="p-4 border-b border-border">
                <TouchableOpacity
                  onPress={() => handleCollectionClick(null)}
                  className={`flex-row items-center gap-3 px-3 py-2.5 rounded-lg ${
                    !selectedCollection ? 'bg-gold/10' : ''
                  }`}
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={20}
                    color={!selectedCollection ? '#C6A664' : '#6B6560'}
                  />
                  <Text className={`${
                    !selectedCollection ? 'text-gold-dark font-medium' : 'text-charcoal'
                  }`}>
                    All Recipes
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Collections - Only show in recipes view */}
            {pageView === 'recipes' && (
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <TouchableOpacity
                    onPress={() => setCollectionsExpanded(!collectionsExpanded)}
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-xs font-medium text-warm-gray uppercase tracking-wide">
                      Collections
                    </Text>
                    <Ionicons
                      name={collectionsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#6B6560"
                    />
                  </TouchableOpacity>
                  {collections.length > 0 && (
                    <TouchableOpacity onPress={() => setIsManageMode(!isManageMode)}>
                      <Text className={`text-xs ${isManageMode ? 'text-gold' : 'text-warm-gray'}`}>
                        {isManageMode ? 'Done' : 'Manage'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {collectionsExpanded && (
                  <View className="space-y-1">
                    {loading ? (
                      <View className="py-4 items-center">
                        <Text className="text-warm-gray text-sm">Loading...</Text>
                      </View>
                    ) : (
                      <>
                        {collections.length === 0 && !isCreatingCollection ? (
                          <Text className="text-sm text-warm-gray py-2 px-3">No collections yet</Text>
                        ) : (
                          collections.map(collection => (
                            <View
                              key={collection.id}
                              className={`flex-row items-center justify-between px-3 py-2 rounded-lg ${
                                selectedCollection === collection.id ? 'bg-gold/10' : ''
                              }`}
                            >
                              {editingCollectionId === collection.id ? (
                                <View className="flex-1 flex-row items-center gap-1">
                                  <TextInput
                                    value={editingCollectionName}
                                    onChangeText={setEditingCollectionName}
                                    className="flex-1 px-2 py-1 text-sm border border-gold rounded bg-white"
                                    autoFocus
                                  />
                                  <TouchableOpacity
                                    onPress={() => handleUpdateCollection(collection.id)}
                                    disabled={savingCollection}
                                  >
                                    <Ionicons name="checkmark" size={20} color="#22C55E" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setEditingCollectionId(null);
                                      setEditingCollectionName('');
                                    }}
                                  >
                                    <Ionicons name="close" size={20} color="#6B6560" />
                                  </TouchableOpacity>
                                </View>
                              ) : isManageMode ? (
                                <View className="flex-1 flex-row items-center justify-between">
                                  <Text className="text-charcoal" numberOfLines={1}>{collection.name}</Text>
                                  <View className="flex-row items-center gap-2 ml-2">
                                    <TouchableOpacity onPress={() => startEditingCollection(collection)}>
                                      <Ionicons name="pencil" size={16} color="#6B6560" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteCollection(collection.id)}>
                                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ) : (
                                <>
                                  <TouchableOpacity
                                    onPress={() => handleCollectionClick(collection.id)}
                                    className="flex-1"
                                  >
                                    <Text
                                      className={`${
                                        selectedCollection === collection.id
                                          ? 'text-gold-dark font-medium'
                                          : 'text-charcoal'
                                      }`}
                                      numberOfLines={1}
                                    >
                                      {collection.name}
                                    </Text>
                                  </TouchableOpacity>
                                  <Text className="text-xs text-warm-gray ml-2">
                                    {collection.recipe_count}
                                  </Text>
                                </>
                              )}
                            </View>
                          ))
                        )}

                        {/* Create new collection */}
                        {isCreatingCollection ? (
                          <View className="flex-row items-center gap-1 px-3 py-2">
                            <TextInput
                              value={newCollectionName}
                              onChangeText={setNewCollectionName}
                              placeholder="Collection name..."
                              placeholderTextColor="#9A948D"
                              className="flex-1 px-2 py-1.5 text-sm border border-gold rounded bg-white"
                              autoFocus
                            />
                            <TouchableOpacity
                              onPress={handleCreateCollection}
                              disabled={savingCollection || !newCollectionName.trim()}
                            >
                              <Ionicons name="checkmark" size={20} color="#22C55E" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setIsCreatingCollection(false);
                                setNewCollectionName('');
                              }}
                            >
                              <Ionicons name="close" size={20} color="#6B6560" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => setIsCreatingCollection(true)}
                            className="flex-row items-center gap-2 px-3 py-2 rounded-lg mt-2"
                          >
                            <Ionicons name="add" size={18} color="#C6A664" />
                            <Text className="text-gold text-sm">New collection</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Shared Collections */}
                {sharedCollections.length > 0 && (
                  <View className="mt-6">
                    <Text className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">
                      Shared with me
                    </Text>
                    <View className="space-y-1">
                      {sharedCollections.map(collection => (
                        <TouchableOpacity
                          key={collection.id}
                          onPress={() => handleCollectionClick(collection.id)}
                          className={`flex-row items-center justify-between px-3 py-2 rounded-lg ${
                            selectedCollection === collection.id ? 'bg-gold/10' : ''
                          }`}
                        >
                          <View className="flex-1 min-w-0">
                            <Text
                              className={`${
                                selectedCollection === collection.id
                                  ? 'text-gold-dark font-medium'
                                  : 'text-charcoal'
                              }`}
                              numberOfLines={1}
                            >
                              {collection.name}
                            </Text>
                            <Text className="text-[10px] text-warm-gray">
                              by {collection.owner.name}
                            </Text>
                          </View>
                          <Text className="text-xs text-warm-gray ml-2">
                            {collection.recipe_count}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View className="border-t border-border p-4" style={{ paddingBottom: insets.bottom + 16 }}>
            <TouchableOpacity
              onPress={() => handleNavClick('Settings')}
              className="flex-row items-center gap-3 px-3 py-2.5 rounded-lg"
            >
              <Ionicons name="settings-outline" size={20} color="#6B6560" />
              <Text className="text-charcoal">Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center gap-3 px-3 py-2.5 rounded-lg"
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="text-red-500">Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
