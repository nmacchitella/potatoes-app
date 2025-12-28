import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { RecipeSummary } from '@/types';

interface RecipeCardProps {
  recipe: RecipeSummary;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function RecipeCard({ recipe, onPress, onLongPress }: RecipeCardProps) {
  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      className="bg-white rounded-xl overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
      activeOpacity={0.9}
    >
      {/* Image */}
      <View className="aspect-square bg-cream-dark">
        {recipe.cover_image_url ? (
          <Image
            source={{ uri: recipe.cover_image_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="restaurant-outline" size={32} color="#9A948D" />
          </View>
        )}
      </View>

      {/* Content */}
      <View className="p-3">
        <Text className="text-charcoal font-medium text-sm" numberOfLines={2}>
          {recipe.title}
        </Text>

        <View className="flex-row items-center mt-2">
          {totalTime > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={12} color="#6B6560" />
              <Text className="text-warm-gray text-xs ml-1">{totalTime} min</Text>
            </View>
          )}

          {recipe.difficulty && (
            <View className="flex-row items-center ml-3">
              <Ionicons name="speedometer-outline" size={12} color="#6B6560" />
              <Text className="text-warm-gray text-xs ml-1 capitalize">
                {recipe.difficulty}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
