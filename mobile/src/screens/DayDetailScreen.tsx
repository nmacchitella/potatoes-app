import { View, ScrollView, RefreshControl, TouchableOpacity, Text } from 'react-native';
import { useState, useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, MealType, RecipeSummary, MealPlan } from '@/types';
import { useMealPlan } from '@/hooks/useMealPlan';
import DayView from '@/components/calendar/DayView';
import RecipePickerModal from '@/components/calendar/RecipePickerModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'DayDetail'>;

export default function DayDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const mealPlan = useMealPlan();

  const date = new Date(route.params.date);
  const [refreshing, setRefreshing] = useState(false);

  // Picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await mealPlan.refresh();
    setRefreshing(false);
  }, [mealPlan.refresh]);

  const handleAddMeal = (d: Date, mealType: MealType) => {
    setSelectedMealType(mealType);
    setPickerVisible(true);
  };

  const handleRecipeSelect = async (recipe: RecipeSummary) => {
    if (selectedMealType) {
      await mealPlan.addMeal(recipe.id, date, selectedMealType);
      setPickerVisible(false);
      setSelectedMealType(null);
    }
  };

  const handleMealPress = (meal: MealPlan) => {
    navigation.navigate('RecipeDetail', { id: meal.recipe.id });
  };

  const formatHeaderDate = () => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const goToPrevDay = () => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    navigation.setParams({ date: prevDay.toISOString().split('T')[0] });
  };

  const goToNextDay = () => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    navigation.setParams({ date: nextDay.toISOString().split('T')[0] });
  };

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-border px-4 py-3 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <View className="flex-row items-center">
          <TouchableOpacity onPress={goToPrevDay} className="p-2">
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
          </TouchableOpacity>

          <Text className="text-lg font-semibold text-charcoal mx-2">
            {formatHeaderDate()}
          </Text>

          <TouchableOpacity onPress={goToNextDay} className="p-2">
            <Ionicons name="chevron-forward" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C6A664"
            colors={['#C6A664']}
          />
        }
      >
        <DayView
          date={date}
          loading={mealPlan.loading}
          getMealsForSlot={mealPlan.getMealsForSlot}
          isToday={mealPlan.isToday}
          isPast={mealPlan.isPast}
          onDeleteMeal={mealPlan.deleteMeal}
          onAddMeal={handleAddMeal}
          onMealPress={handleMealPress}
        />
      </ScrollView>

      {/* Recipe Picker Modal */}
      <RecipePickerModal
        visible={pickerVisible}
        date={date}
        mealType={selectedMealType}
        onSelect={handleRecipeSelect}
        onClose={() => {
          setPickerVisible(false);
          setSelectedMealType(null);
        }}
      />
    </View>
  );
}
