import { View, Text, TouchableOpacity, FlatList, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecipeSummary, MealType } from '@/types';
import { recipeApi } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

interface RecipePickerModalProps {
  visible: boolean;
  date: Date | null;
  mealType: MealType | null;
  onSelect: (recipe: RecipeSummary) => void;
  onClose: () => void;
}

export default function RecipePickerModal({
  visible,
  date,
  mealType,
  onSelect,
  onClose,
}: RecipePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await recipeApi.list({
        page_size: 50,
        search: debouncedSearch || undefined,
      });
      setRecipes(response.items);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (visible) {
      fetchRecipes();
    }
  }, [visible, fetchRecipes]);

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getMealLabel = (type: MealType) => {
    switch (type) {
      case 'breakfast':
        return 'Breakfast';
      case 'lunch':
        return 'Lunch';
      case 'dinner':
        return 'Dinner';
      default:
        return type;
    }
  };

  const renderRecipe = ({ item }: { item: RecipeSummary }) => (
    <TouchableOpacity
      onPress={() => onSelect(item)}
      className="flex-row items-center bg-white px-4 py-3 border-b border-border"
      activeOpacity={0.7}
    >
      {item.cover_image_url ? (
        <Image
          source={{ uri: item.cover_image_url }}
          style={{ width: 56, height: 56, borderRadius: 8 }}
          contentFit="cover"
        />
      ) : (
        <View className="w-14 h-14 bg-cream-dark rounded-lg items-center justify-center">
          <Ionicons name="restaurant-outline" size={24} color="#9A948D" />
        </View>
      )}
      <View className="flex-1 ml-3">
        <Text className="text-charcoal font-medium" numberOfLines={2}>
          {item.title}
        </Text>
        {(item.prep_time_minutes || item.cook_time_minutes) && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="time-outline" size={12} color="#6B6560" />
            <Text className="text-warm-gray text-xs ml-1">
              {(item.prep_time_minutes || 0) + (item.cook_time_minutes || 0)} min
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="add-circle" size={24} color="#C6A664" />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="bg-white border-b border-border px-4 py-3">
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-charcoal">Add Recipe</Text>
            <View className="w-10" />
          </View>

          {date && mealType && (
            <View className="bg-cream rounded-lg px-3 py-2 mb-3">
              <Text className="text-sm text-charcoal">
                {getMealLabel(mealType)} on {formatDate(date)}
              </Text>
            </View>
          )}

          {/* Search */}
          <View className="flex-row items-center bg-cream rounded-lg px-4">
            <Ionicons name="search" size={18} color="#6B6560" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search recipes..."
              placeholderTextColor="#9A948D"
              className="flex-1 py-3 ml-2 text-charcoal"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color="#6B6560" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recipe List */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#C6A664" />
          </View>
        ) : recipes.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="restaurant-outline" size={48} color="#9A948D" />
            <Text className="text-warm-gray text-center mt-4">
              {search ? `No recipes found for "${search}"` : 'No recipes yet'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(item) => item.id}
            renderItem={renderRecipe}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
          />
        )}
      </View>
    </Modal>
  );
}
