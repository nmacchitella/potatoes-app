import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, RecipeSummary, MealType } from '@/types';
import { recipeApi, collectionApi } from '@/lib/api';
import TopBar from '@/components/layout/TopBar';
import MobileSidebar from '@/components/layout/MobileSidebar';
import RecipeCard from '@/components/recipes/RecipeCard';
import WeekView from '@/components/calendar/WeekView';
import RecipePickerModal from '@/components/calendar/RecipePickerModal';
import { useMealPlan } from '@/hooks/useMealPlan';
import TagFilterBar from '@/components/recipes/TagFilterBar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PageView = 'recipes' | 'calendar';
type CalendarMode = 'day' | 'week' | 'month';

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pageView, setPageView] = useState<PageView>('recipes');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Meal planning state
  const mealPlan = useMealPlan();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);

  const fetchRecipes = useCallback(async () => {
    try {
      if (selectedCollection) {
        const collection = await collectionApi.get(selectedCollection);
        setRecipes(collection.recipes);
        setCollectionName(collection.name);
      } else {
        const params: { page_size: number; tag_ids?: string } = { page_size: 50 };
        if (selectedTags.length > 0) {
          params.tag_ids = selectedTags.join(',');
        }
        const response = await recipeApi.list(params);
        setRecipes(response.items);
        setCollectionName(null);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCollection, selectedTags]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRecipes(), mealPlan.refresh()]);
    setRefreshing(false);
  }, [fetchRecipes, mealPlan.refresh]);

  const handleAddMeal = (date: Date, mealType: MealType) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setPickerVisible(true);
  };

  const handleRecipeSelect = async (recipe: RecipeSummary) => {
    if (selectedDate && selectedMealType) {
      await mealPlan.addMeal(recipe.id, selectedDate, selectedMealType);
      setPickerVisible(false);
      setSelectedDate(null);
      setSelectedMealType(null);
    }
  };

  return (
    <View className="flex-1 bg-cream">
      <TopBar onMenuPress={() => setSidebarOpen(true)} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 80 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C6A664"
            colors={['#C6A664']}
          />
        }
      >
        {/* Week Calendar View */}
        <WeekView
          dates={mealPlan.dates}
          offset={mealPlan.offset}
          loading={mealPlan.loading}
          getMealsForDate={mealPlan.getMealsForDate}
          getMealsForSlot={mealPlan.getMealsForSlot}
          isToday={mealPlan.isToday}
          isPast={mealPlan.isPast}
          onGoPrev={mealPlan.goPrev}
          onGoNext={mealPlan.goNext}
          onGoToday={mealPlan.goToday}
          onDeleteMeal={mealPlan.deleteMeal}
          onAddMeal={handleAddMeal}
        />

        {/* Tag Filter Bar */}
        {!selectedCollection && (
          <TagFilterBar
            selectedTagIds={selectedTags}
            onTagsChange={setSelectedTags}
          />
        )}

        {/* Recipe Grid */}
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-charcoal font-semibold text-lg">
              {collectionName || 'My Recipes'}
            </Text>
            {selectedCollection && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedCollection(null);
                  setCollectionName(null);
                }}
                className="flex-row items-center"
              >
                <Ionicons name="close-circle" size={20} color="#9A948D" />
                <Text className="text-warm-gray text-sm ml-1">Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View className="items-center py-8">
              <Text className="text-warm-gray">Loading recipes...</Text>
            </View>
          ) : recipes.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="restaurant-outline" size={48} color="#9A948D" />
              <Text className="text-warm-gray mt-2">No recipes yet</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Main')}
                className="mt-4 bg-gold px-6 py-3 rounded-full"
              >
                <Text className="text-white font-medium">Add your first recipe</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row flex-wrap -mx-1">
              {recipes.map((recipe) => (
                <View key={recipe.id} className="w-1/2 px-1 mb-2">
                  <RecipeCard
                    recipe={recipe}
                    onPress={() =>
                      navigation.navigate('RecipeDetail', { id: recipe.id })
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Recipe Picker Modal */}
      <RecipePickerModal
        visible={pickerVisible}
        date={selectedDate}
        mealType={selectedMealType}
        onSelect={handleRecipeSelect}
        onClose={() => {
          setPickerVisible(false);
          setSelectedDate(null);
          setSelectedMealType(null);
        }}
      />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pageView={pageView}
        onPageViewChange={setPageView}
        calendarMode={calendarMode}
        onCalendarModeChange={setCalendarMode}
        selectedCollection={selectedCollection}
        onCollectionSelect={setSelectedCollection}
      />
    </View>
  );
}
