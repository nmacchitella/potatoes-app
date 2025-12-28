import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, MealPlan, MealType } from '@/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
];

interface WeekViewProps {
  dates: Date[];
  offset: number;
  loading: boolean;
  getMealsForDate: (date: Date) => MealPlan[];
  getMealsForSlot: (date: Date, mealType: MealType) => MealPlan[];
  isToday: (date: Date) => boolean;
  isPast: (date: Date) => boolean;
  onGoPrev: () => void;
  onGoNext: () => void;
  onGoToday: () => void;
  onDeleteMeal: (mealId: string) => Promise<boolean>;
  onAddMeal: (date: Date, mealType: MealType) => void;
}

export default function WeekView({
  dates,
  offset,
  loading,
  getMealsForDate,
  getMealsForSlot,
  isToday,
  isPast,
  onGoPrev,
  onGoNext,
  onGoToday,
  onDeleteMeal,
  onAddMeal,
}: WeekViewProps) {
  const navigation = useNavigation<NavigationProp>();

  const handleMealPress = (meal: MealPlan) => {
    Alert.alert(meal.recipe.title, `${meal.servings} servings`, [
      {
        text: 'View Recipe',
        onPress: () => navigation.navigate('RecipeDetail', { id: meal.recipe.id }),
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onDeleteMeal(meal.id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const formatDateRange = () => {
    const start = dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = dates[2].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  return (
    <View className="bg-white border-b border-border">
      {/* Navigation Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity onPress={onGoPrev} className="p-2" activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#6B6560" />
        </TouchableOpacity>

        <View className="flex-row items-center">
          <Text className="text-sm font-medium text-charcoal">{formatDateRange()}</Text>
          {offset !== 0 && (
            <TouchableOpacity
              onPress={onGoToday}
              className="ml-3 px-3 py-1 bg-gold rounded-full"
              activeOpacity={0.8}
            >
              <Text className="text-xs font-medium text-white">Today</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={onGoNext} className="p-2" activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color="#6B6560" />
        </TouchableOpacity>
      </View>

      {/* 3-Day Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-3">
        <View className="flex-row px-2">
          {dates.map((date, index) => {
            const dayMeals = getMealsForDate(date);
            const past = isPast(date);
            const today = isToday(date);

            return (
              <View
                key={index}
                className={`w-32 mx-1 rounded-xl border overflow-hidden ${
                  today ? 'border-gold' : 'border-border'
                }`}
              >
                {/* Day Header */}
                <View
                  className={`px-2 py-2 items-center border-b ${
                    today
                      ? 'bg-gold/10 border-gold/30'
                      : past
                      ? 'bg-gray-50 border-border'
                      : 'border-border'
                  }`}
                >
                  <Text
                    className={`text-xs uppercase tracking-wide ${
                      past ? 'text-gray-400' : 'text-warm-gray'
                    }`}
                  >
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text
                    className={`text-lg ${
                      today
                        ? 'text-gold-dark font-semibold'
                        : past
                        ? 'text-gray-400'
                        : 'text-charcoal'
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                </View>

                {/* Meals for this day */}
                <View className="p-2 min-h-[180px]">
                  {loading ? (
                    <View className="space-y-2">
                      <View className="bg-cream-dark rounded h-12" />
                      <View className="bg-cream-dark rounded h-12" />
                    </View>
                  ) : dayMeals.length > 0 ? (
                    <>
                      {MEAL_TYPES.map(({ key: mealType, label }) => {
                        const meals = getMealsForSlot(date, mealType);
                        if (meals.length === 0) return null;
                        return (
                          <View key={mealType} className="mb-2">
                            <Text className="text-[10px] text-warm-gray uppercase mb-1">
                              {label}
                            </Text>
                            {meals.map((meal) => (
                              <TouchableOpacity
                                key={meal.id}
                                onPress={() => handleMealPress(meal)}
                                className="bg-cream rounded-lg p-2 mb-1"
                                activeOpacity={0.7}
                              >
                                {meal.recipe.cover_image_url && (
                                  <Image
                                    source={{ uri: meal.recipe.cover_image_url }}
                                    style={{
                                      width: '100%',
                                      height: 48,
                                      borderRadius: 4,
                                      marginBottom: 4,
                                    }}
                                    contentFit="cover"
                                  />
                                )}
                                <Text
                                  className="text-xs font-medium text-charcoal"
                                  numberOfLines={2}
                                >
                                  {meal.recipe.title}
                                </Text>
                                <Text className="text-[10px] text-warm-gray">
                                  {meal.servings} servings
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      })}

                      {/* Add button when there are meals */}
                      <TouchableOpacity
                        onPress={() => onAddMeal(date, 'dinner')}
                        className="py-2 border-t border-border mt-1"
                        activeOpacity={0.7}
                      >
                        <Text className="text-[10px] text-warm-gray text-center">
                          + Add
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // Empty day - show add buttons for each meal type
                    <View className="flex-1 justify-center">
                      {MEAL_TYPES.map(({ key: mealType, label }) => (
                        <TouchableOpacity
                          key={mealType}
                          onPress={() => onAddMeal(date, mealType)}
                          className="py-3 border-b border-border last:border-b-0"
                          activeOpacity={0.7}
                        >
                          <Text className="text-[10px] text-warm-gray text-center">
                            + {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
