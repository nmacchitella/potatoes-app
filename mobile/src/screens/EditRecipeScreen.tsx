import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, RecipeIngredientInput, RecipeInstructionInput } from '@/types';
import { recipeApi, getErrorMessage } from '@/lib/api';
import { useImagePicker } from '@/hooks/useImagePicker';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'EditRecipe'>;

export default function EditRecipeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { image, setImage, showImageOptions, clearImage, loading: imageLoading, uploading: imageUploading } = useImagePicker({ recipeId: id });

  const [loadingRecipe, setLoadingRecipe] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [ingredients, setIngredients] = useState<RecipeIngredientInput[]>([]);
  const [newIngredient, setNewIngredient] = useState('');

  const [instructions, setInstructions] = useState<RecipeInstructionInput[]>([]);
  const [newInstruction, setNewInstruction] = useState('');

  useEffect(() => {
    async function loadRecipe() {
      try {
        const recipe = await recipeApi.get(id);
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setPrepTime(recipe.prep_time_minutes?.toString() || '');
        setCookTime(recipe.cook_time_minutes?.toString() || '');

        if (recipe.cover_image_url) {
          setImage(recipe.cover_image_url);
        }

        // Convert ingredients
        const loadedIngredients = recipe.ingredients.map((ing, idx) => ({
          sort_order: ing.sort_order || idx,
          quantity: ing.quantity,
          quantity_max: ing.quantity_max,
          unit: ing.unit,
          name: ing.name,
          preparation: ing.preparation,
          is_optional: ing.is_optional,
          is_staple: ing.is_staple,
          ingredient_group: ing.ingredient_group,
          notes: ing.notes,
        }));
        setIngredients(loadedIngredients);

        // Convert instructions
        const loadedInstructions = recipe.instructions.map((inst) => ({
          step_number: inst.step_number,
          instruction_text: inst.instruction_text,
          duration_minutes: inst.duration_minutes,
          instruction_group: inst.instruction_group,
        }));
        setInstructions(loadedInstructions);
      } catch (error) {
        Alert.alert('Error', getErrorMessage(error), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoadingRecipe(false);
      }
    }

    loadRecipe();
  }, [id]);

  const addIngredient = () => {
    if (!newIngredient.trim()) return;
    setIngredients([
      ...ingredients,
      { sort_order: ingredients.length, name: newIngredient.trim() },
    ]);
    setNewIngredient('');
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addInstruction = () => {
    if (!newInstruction.trim()) return;
    setInstructions([
      ...instructions,
      { step_number: instructions.length + 1, instruction_text: newInstruction.trim() },
    ]);
    setNewInstruction('');
  };

  const removeInstruction = (index: number) => {
    const updated = instructions
      .filter((_, i) => i !== index)
      .map((inst, idx) => ({ ...inst, step_number: idx + 1 }));
    setInstructions(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a recipe title');
      return;
    }

    setSaving(true);
    try {
      await recipeApi.update(id, {
        title: title.trim(),
        description: description.trim() || undefined,
        prep_time_minutes: prepTime ? parseInt(prepTime, 10) : undefined,
        cook_time_minutes: cookTime ? parseInt(cookTime, 10) : undefined,
        cover_image_url: image || undefined,
        ingredients: ingredients.length > 0 ? ingredients : undefined,
        instructions: instructions.length > 0 ? instructions : undefined,
      });

      Alert.alert('Success', 'Recipe updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Save Failed', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await recipeApi.delete(id);
              Alert.alert('Deleted', 'Recipe has been deleted.');
              navigation.navigate('Main');
            } catch (error) {
              Alert.alert('Error', getErrorMessage(error));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loadingRecipe) {
    return (
      <View className="flex-1 items-center justify-center bg-cream" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#C6A664" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="px-4 py-4 border-b border-border bg-white flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 mr-2">
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-xl font-semibold text-charcoal">Edit Recipe</Text>
          </View>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            className="p-2"
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            )}
          </TouchableOpacity>
        </View>

        {/* Cover Image */}
        <TouchableOpacity
          onPress={showImageOptions}
          className="mx-4 mt-4 bg-white rounded-xl border border-border overflow-hidden"
          activeOpacity={0.8}
        >
          {image ? (
            <View className="relative">
              <Image source={{ uri: image }} style={{ width: '100%', height: 200 }} contentFit="cover" />
              {imageUploading && (
                <View className="absolute inset-0 bg-black/50 items-center justify-center">
                  <ActivityIndicator size="large" color="white" />
                  <Text className="text-white mt-2">Uploading...</Text>
                </View>
              )}
              {!imageUploading && (
                <TouchableOpacity
                  onPress={clearImage}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="h-40 items-center justify-center">
              {imageLoading || imageUploading ? (
                <ActivityIndicator size="large" color="#C6A664" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={40} color="#9A948D" />
                  <Text className="text-warm-gray mt-2">Take photo or choose image</Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Form */}
        <View className="px-4 mt-4">
          {/* Title */}
          <View className="mb-4">
            <Text className="text-charcoal font-medium mb-2">Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Recipe name"
              placeholderTextColor="#9A948D"
              className="bg-white border border-border rounded-lg px-4 py-3 text-charcoal"
            />
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="text-charcoal font-medium mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description..."
              placeholderTextColor="#9A948D"
              multiline
              numberOfLines={3}
              className="bg-white border border-border rounded-lg px-4 py-3 text-charcoal"
              style={{ textAlignVertical: 'top', minHeight: 80 }}
            />
          </View>

          {/* Time inputs */}
          <View className="flex-row mb-4">
            <View className="flex-1 mr-2">
              <Text className="text-charcoal font-medium mb-2">Prep Time</Text>
              <TextInput
                value={prepTime}
                onChangeText={setPrepTime}
                placeholder="mins"
                placeholderTextColor="#9A948D"
                keyboardType="number-pad"
                className="bg-white border border-border rounded-lg px-4 py-3 text-charcoal"
              />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-charcoal font-medium mb-2">Cook Time</Text>
              <TextInput
                value={cookTime}
                onChangeText={setCookTime}
                placeholder="mins"
                placeholderTextColor="#9A948D"
                keyboardType="number-pad"
                className="bg-white border border-border rounded-lg px-4 py-3 text-charcoal"
              />
            </View>
          </View>

          {/* Ingredients Section */}
          <View className="bg-white border border-border rounded-xl p-4 mb-4">
            <Text className="text-charcoal font-medium mb-3">Ingredients ({ingredients.length})</Text>

            {ingredients.map((ing, index) => (
              <View key={index} className="flex-row items-center py-2 border-b border-border">
                <Text className="flex-1 text-charcoal">
                  {ing.quantity && `${ing.quantity} `}
                  {ing.unit && `${ing.unit} `}
                  {ing.name}
                  {ing.preparation && `, ${ing.preparation}`}
                </Text>
                <TouchableOpacity onPress={() => removeIngredient(index)} className="p-1">
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            <View className="flex-row items-center mt-3">
              <TextInput
                value={newIngredient}
                onChangeText={setNewIngredient}
                placeholder="Add ingredient..."
                placeholderTextColor="#9A948D"
                className="flex-1 bg-cream rounded-lg px-4 py-3 text-charcoal mr-2"
                onSubmitEditing={addIngredient}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addIngredient} className="bg-gold p-3 rounded-lg">
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Instructions Section */}
          <View className="bg-white border border-border rounded-xl p-4 mb-4">
            <Text className="text-charcoal font-medium mb-3">Instructions ({instructions.length})</Text>

            {instructions.map((inst, index) => (
              <View key={index} className="flex-row py-3 border-b border-border">
                <View className="w-7 h-7 bg-gold rounded-full items-center justify-center mr-3">
                  <Text className="text-white font-semibold text-sm">{inst.step_number}</Text>
                </View>
                <Text className="flex-1 text-charcoal">{inst.instruction_text}</Text>
                <TouchableOpacity onPress={() => removeInstruction(index)} className="p-1">
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            <View className="flex-row items-center mt-3">
              <TextInput
                value={newInstruction}
                onChangeText={setNewInstruction}
                placeholder="Add step..."
                placeholderTextColor="#9A948D"
                className="flex-1 bg-cream rounded-lg px-4 py-3 text-charcoal mr-2"
                multiline
              />
              <TouchableOpacity onPress={addInstruction} className="bg-gold p-3 rounded-lg">
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className={`py-4 rounded-xl items-center ${saving ? 'bg-gold-light' : 'bg-gold'}`}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
