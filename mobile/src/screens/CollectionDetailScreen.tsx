import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, CollectionWithRecipes, RecipeSummary } from '@/types';
import { collectionApi, getErrorMessage } from '@/lib/api';
import { useStore } from '@/store/useStore';
import RecipeCard from '@/components/recipes/RecipeCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'CollectionDetail'>;

export default function CollectionDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { user } = useStore();
  const { id } = route.params;

  const [collection, setCollection] = useState<CollectionWithRecipes | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCollection = useCallback(async () => {
    try {
      const data = await collectionApi.get(id);
      setCollection(data);
    } catch (error) {
      console.error('Failed to fetch collection:', error);
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCollection();
    setRefreshing(false);
  }, [fetchCollection]);

  const handleRemoveRecipe = async (recipeId: string) => {
    if (!collection) return;

    Alert.alert(
      'Remove Recipe',
      'Remove this recipe from the collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionApi.removeRecipe(id, recipeId);
              setCollection(prev => prev ? {
                ...prev,
                recipes: prev.recipes.filter(r => r.id !== recipeId),
                recipe_count: prev.recipe_count - 1,
              } : null);
            } catch (error) {
              Alert.alert('Error', getErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const handleDeleteCollection = async () => {
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
              await collectionApi.delete(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', getErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const handleLeaveCollection = async () => {
    Alert.alert(
      'Leave Collection',
      'Leave this shared collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionApi.leave(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', getErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const isOwner = collection?.user_id === user?.id;

  if (loading) {
    return (
      <View className="flex-1 bg-cream items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#C6A664" />
      </View>
    );
  }

  if (!collection) {
    return (
      <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
        <View className="bg-white border-b border-border px-4 py-3 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="p-2 -ml-2 mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-xl font-semibold text-charcoal">Collection</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-warm-gray">Collection not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-border px-4 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="p-2 -ml-2 mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <View className="flex-1 mr-4">
            <Text className="text-xl font-semibold text-charcoal" numberOfLines={1}>
              {collection.name}
            </Text>
            <Text className="text-sm text-warm-gray">
              {collection.recipe_count} {collection.recipe_count === 1 ? 'recipe' : 'recipes'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row items-center gap-2">
          {isOwner ? (
            <TouchableOpacity
              onPress={handleDeleteCollection}
              className="p-2"
            >
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleLeaveCollection}
              className="p-2"
            >
              <Ionicons name="exit-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
        {/* Description */}
        {collection.description && (
          <View className="px-4 py-3 bg-cream-dark border-b border-border">
            <Text className="text-charcoal">{collection.description}</Text>
          </View>
        )}

        {/* Privacy Badge */}
        <View className="px-4 py-3 flex-row items-center gap-2">
          <Ionicons
            name={collection.privacy_level === 'public' ? 'globe-outline' : 'lock-closed-outline'}
            size={16}
            color="#6B6560"
          />
          <Text className="text-sm text-warm-gray capitalize">
            {collection.privacy_level}
          </Text>
        </View>

        {/* Recipe Grid */}
        <View className="p-4">
          {collection.recipes.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="restaurant-outline" size={48} color="#9A948D" />
              <Text className="text-warm-gray mt-2">No recipes in this collection</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap -mx-1">
              {collection.recipes.map((recipe) => (
                <View key={recipe.id} className="w-1/2 px-1 mb-2">
                  <RecipeCard
                    recipe={recipe}
                    onPress={() => navigation.navigate('RecipeDetail', { id: recipe.id })}
                    onLongPress={isOwner ? () => handleRemoveRecipe(recipe.id) : undefined}
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
