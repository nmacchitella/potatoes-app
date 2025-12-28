import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, RecipeWithScale } from '@/types';
import { recipeApi, getErrorMessage } from '@/lib/api';
import { useStore } from '@/store/useStore';
import AddToCollectionModal from '@/components/collections/AddToCollectionModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RecipeDetailRouteProp = RouteProp<RootStackParamList, 'RecipeDetail'>;

export default function RecipeDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RecipeDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const { user } = useStore();
  const { id } = route.params;

  const [recipe, setRecipe] = useState<RecipeWithScale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [scale, setScale] = useState(1);
  const [cloning, setCloning] = useState(false);

  const isOwner = recipe?.author_id === user?.id;

  const SCALE_OPTIONS = [0.5, 1, 1.5, 2, 3, 4];

  const fetchRecipe = async (recipeScale: number = 1) => {
    try {
      setLoading(true);
      const data = await recipeApi.get(id, recipeScale);
      setRecipe(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipe(scale);
  }, [id, scale]);

  const handleClone = async () => {
    setCloning(true);
    try {
      const clonedRecipe = await recipeApi.clone(id);
      Alert.alert(
        'Recipe Cloned',
        'A copy of this recipe has been added to your collection.',
        [
          { text: 'View Clone', onPress: () => navigation.navigate('RecipeDetail', { id: clonedRecipe.id }) },
          { text: 'OK' },
        ]
      );
    } catch (err) {
      Alert.alert('Clone Failed', getErrorMessage(err));
    } finally {
      setCloning(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator size="large" color="#C6A664" />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View className="flex-1 items-center justify-center bg-cream px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#6B6560" />
        <Text className="text-warm-gray text-center mt-4">{error || 'Recipe not found'}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-6 bg-gold px-6 py-3 rounded-full"
        >
          <Text className="text-white font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <View className="flex-1 bg-cream">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Hero Image */}
        <View className="relative">
          {recipe.cover_image_url ? (
            <Image
              source={{ uri: recipe.cover_image_url }}
              style={{ width: '100%', height: 300 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-full h-64 bg-cream-dark items-center justify-center">
              <Ionicons name="restaurant-outline" size={64} color="#9A948D" />
            </View>
          )}

          {/* Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="absolute top-12 left-4 w-10 h-10 bg-white/90 rounded-full items-center justify-center"
            style={{ marginTop: insets.top - 40 }}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View
            className="absolute top-12 right-4 flex-row gap-2"
            style={{ marginTop: insets.top - 40 }}
          >
            <TouchableOpacity
              onPress={() => setShowCollectionModal(true)}
              className="w-10 h-10 bg-white/90 rounded-full items-center justify-center"
            >
              <Ionicons name="folder-outline" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            {!isOwner && (
              <TouchableOpacity
                onPress={handleClone}
                disabled={cloning}
                className="w-10 h-10 bg-white/90 rounded-full items-center justify-center"
              >
                {cloning ? (
                  <ActivityIndicator size="small" color="#1A1A1A" />
                ) : (
                  <Ionicons name="copy-outline" size={20} color="#1A1A1A" />
                )}
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity
                onPress={() => navigation.navigate('EditRecipe', { id })}
                className="w-10 h-10 bg-white/90 rounded-full items-center justify-center"
              >
                <Ionicons name="pencil" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        <View className="px-4 -mt-6">
          <View className="bg-white rounded-2xl p-5 border border-border">
            {/* Title */}
            <Text className="text-2xl font-semibold text-charcoal">
              {recipe.title}
            </Text>

            {/* Meta */}
            <View className="flex-row items-center mt-3 flex-wrap">
              {totalTime > 0 && (
                <View className="flex-row items-center mr-4 mb-2">
                  <Ionicons name="time-outline" size={16} color="#6B6560" />
                  <Text className="text-warm-gray ml-1">{totalTime} min</Text>
                </View>
              )}
              {recipe.difficulty && (
                <View className="flex-row items-center mr-4 mb-2">
                  <Ionicons name="speedometer-outline" size={16} color="#6B6560" />
                  <Text className="text-warm-gray ml-1 capitalize">{recipe.difficulty}</Text>
                </View>
              )}
              <View className="flex-row items-center mb-2">
                <Ionicons name="people-outline" size={16} color="#6B6560" />
                <Text className="text-warm-gray ml-1">
                  {recipe.scaled_yield_quantity || recipe.yield_quantity} {recipe.yield_unit}
                </Text>
              </View>
            </View>

            {/* Scale Selector */}
            <View className="mt-4 pt-4 border-t border-border">
              <Text className="text-charcoal font-medium mb-2">Scale Recipe</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {SCALE_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setScale(option)}
                      className={`px-4 py-2 rounded-full border ${
                        scale === option
                          ? 'bg-gold border-gold'
                          : 'bg-white border-border'
                      }`}
                    >
                      <Text
                        className={`font-medium ${
                          scale === option ? 'text-white' : 'text-charcoal'
                        }`}
                      >
                        {option}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Description */}
            {recipe.description && (
              <Text className="text-warm-gray mt-3">{recipe.description}</Text>
            )}
          </View>

          {/* Ingredients */}
          <View className="bg-white rounded-2xl p-5 mt-4 border border-border">
            <Text className="text-lg font-semibold text-charcoal mb-4">Ingredients</Text>
            {recipe.ingredients.length === 0 ? (
              <Text className="text-warm-gray">No ingredients listed</Text>
            ) : (
              recipe.ingredients.map((ingredient, index) => (
                <View
                  key={ingredient.id || index}
                  className="flex-row items-start py-2 border-b border-border"
                >
                  <View className="w-5 h-5 border-2 border-gold rounded mr-3 mt-0.5" />
                  <Text className="flex-1 text-charcoal">
                    {ingredient.quantity && `${ingredient.quantity} `}
                    {ingredient.unit && `${ingredient.unit} `}
                    <Text className="font-medium">{ingredient.name}</Text>
                    {ingredient.preparation && (
                      <Text className="text-warm-gray">, {ingredient.preparation}</Text>
                    )}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Instructions */}
          <View className="bg-white rounded-2xl p-5 mt-4 border border-border">
            <Text className="text-lg font-semibold text-charcoal mb-4">Instructions</Text>
            {recipe.instructions.length === 0 ? (
              <Text className="text-warm-gray">No instructions listed</Text>
            ) : (
              recipe.instructions.map((instruction, index) => (
                <View key={instruction.id || index} className="flex-row mb-4">
                  <View className="w-8 h-8 bg-gold rounded-full items-center justify-center mr-3 mt-1">
                    <Text className="text-white font-semibold">
                      {instruction.step_number}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-charcoal">{instruction.instruction_text}</Text>
                    {instruction.duration_minutes && (
                      <View className="flex-row items-center mt-2">
                        <Ionicons name="time-outline" size={14} color="#6B6560" />
                        <Text className="text-warm-gray text-sm ml-1">
                          {instruction.duration_minutes} min
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add to Collection Modal */}
      <AddToCollectionModal
        visible={showCollectionModal}
        recipeId={id}
        onClose={() => setShowCollectionModal(false)}
      />
    </View>
  );
}
