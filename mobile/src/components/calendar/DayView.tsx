import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { MealPlan, MealType } from '@/types';

interface DayViewProps {
  date: Date;
  loading: boolean;
  getMealsForSlot: (date: Date, mealType: MealType) => MealPlan[];
  isToday: (date: Date) => boolean;
  isPast: (date: Date) => boolean;
  onDeleteMeal: (mealId: string) => void;
  onAddMeal: (date: Date, mealType: MealType) => void;
  onMealPress?: (meal: MealPlan) => void;
}

const MEAL_SLOTS: { type: MealType; label: string; icon: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { type: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { type: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { type: 'snack', label: 'Snack', icon: 'cafe-outline' },
];

export default function DayView({
  date,
  loading,
  getMealsForSlot,
  isToday,
  isPast,
  onDeleteMeal,
  onAddMeal,
  onMealPress,
}: DayViewProps) {
  const formatDate = () => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View className="bg-white rounded-2xl mx-4 p-8 items-center justify-center">
        <ActivityIndicator size="large" color="#C6A664" />
      </View>
    );
  }

  const past = isPast(date);

  return (
    <View className="bg-white rounded-2xl mx-4 overflow-hidden">
      {/* Header */}
      <View className="p-4 border-b border-border flex-row items-center">
        {isToday(date) && (
          <View className="bg-gold px-2 py-1 rounded mr-2">
            <Text className="text-white text-xs font-medium">Today</Text>
          </View>
        )}
        <Text className="text-lg font-semibold text-charcoal">{formatDate()}</Text>
      </View>

      {/* Meal Slots */}
      {MEAL_SLOTS.map(({ type, label, icon }) => {
        const meals = getMealsForSlot(date, type);

        return (
          <View key={type} className="border-b border-border last:border-b-0">
            {/* Slot Header */}
            <View className="flex-row items-center px-4 py-3 bg-cream">
              <Ionicons name={icon as any} size={18} color="#6B6560" />
              <Text className="text-charcoal font-medium ml-2">{label}</Text>
            </View>

            {/* Meals in this slot */}
            <View className="p-2">
              {meals.length === 0 ? (
                <TouchableOpacity
                  onPress={() => onAddMeal(date, type)}
                  className="flex-row items-center justify-center py-4 border border-dashed border-border rounded-lg"
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#C6A664" />
                  <Text className="text-gold ml-2">Add meal</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  {meals.map(meal => (
                    <TouchableOpacity
                      key={meal.id}
                      onPress={() => onMealPress?.(meal)}
                      className="flex-row items-center p-3 bg-cream-light rounded-lg mb-2 last:mb-0"
                      activeOpacity={0.8}
                    >
                      {/* Recipe Image */}
                      {meal.recipe.cover_image_url ? (
                        <Image
                          source={{ uri: meal.recipe.cover_image_url }}
                          style={{ width: 48, height: 48, borderRadius: 8 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View className="w-12 h-12 bg-cream rounded-lg items-center justify-center">
                          <Ionicons name="restaurant-outline" size={20} color="#9A948D" />
                        </View>
                      )}

                      {/* Recipe Info */}
                      <View className="flex-1 ml-3">
                        <Text className="text-charcoal font-medium" numberOfLines={1}>
                          {meal.recipe.title}
                        </Text>
                        {meal.servings > 1 && (
                          <Text className="text-warm-gray text-xs mt-0.5">
                            {meal.servings} servings
                          </Text>
                        )}
                      </View>

                      {/* Delete Button */}
                      {!past && (
                        <TouchableOpacity
                          onPress={() => onDeleteMeal(meal.id)}
                          className="p-2"
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* Add Another Button */}
                  <TouchableOpacity
                    onPress={() => onAddMeal(date, type)}
                    className="flex-row items-center justify-center py-2 mt-1"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color="#C6A664" />
                    <Text className="text-gold text-sm ml-1">Add another</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
