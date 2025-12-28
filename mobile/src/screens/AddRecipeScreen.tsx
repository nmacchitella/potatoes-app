import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, RecipeIngredientInput, RecipeInstructionInput, Tag } from '@/types';
import { recipeApi, tagApi, getErrorMessage } from '@/lib/api';
import { useImagePicker } from '@/hooks/useImagePicker';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AddRecipeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { image, showImageOptions, clearImage, loading: imageLoading, uploading: imageUploading, uploadPendingImage, hasLocalImage } = useImagePicker();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ingredients, setIngredients] = useState<RecipeIngredientInput[]>([]);
  const [newIngredient, setNewIngredient] = useState('');

  const [instructions, setInstructions] = useState<RecipeInstructionInput[]>([]);
  const [newInstruction, setNewInstruction] = useState('');

  // New fields for parity with web
  const [privacyLevel, setPrivacyLevel] = useState<'private' | 'public'>('private');
  const [difficulty, setDifficulty] = useState<'' | 'easy' | 'medium' | 'hard'>('');
  const [notes, setNotes] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  useEffect(() => {
    tagApi.list().then(setAvailableTags).catch(console.error);
  }, []);

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    setImporting(true);
    try {
      const result = await recipeApi.importFromUrl(importUrl.trim());
      if (result.recipes && result.recipes.length > 0) {
        const imported = result.recipes[0];
        setTitle(imported.title || '');
        setDescription(imported.description || '');
        setPrepTime(imported.prep_time_minutes?.toString() || '');
        setCookTime(imported.cook_time_minutes?.toString() || '');

        const importedIngredients = imported.ingredients.map((ing, idx) => ({
          sort_order: idx,
          quantity: ing.quantity,
          quantity_max: ing.quantity_max,
          unit: ing.unit,
          name: ing.name,
          preparation: ing.preparation,
          is_optional: ing.is_optional,
          notes: ing.notes,
        }));
        setIngredients(importedIngredients);

        const importedInstructions = imported.instructions.map((inst) => ({
          step_number: inst.step_number,
          instruction_text: inst.instruction_text,
          duration_minutes: inst.duration_minutes,
        }));
        setInstructions(importedInstructions);

        Alert.alert('Success', 'Recipe imported! Review and save.');
        setImportUrl('');
      }
    } catch (error) {
      Alert.alert('Import Failed', getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

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
      // Create recipe first (without image if it's a local file)
      const recipe = await recipeApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        prep_time_minutes: prepTime ? parseInt(prepTime, 10) : undefined,
        cook_time_minutes: cookTime ? parseInt(cookTime, 10) : undefined,
        cover_image_url: hasLocalImage ? undefined : (image || undefined),
        ingredients: ingredients.length > 0 ? ingredients : undefined,
        instructions: instructions.length > 0 ? instructions : undefined,
        privacy_level: privacyLevel,
        difficulty: difficulty || undefined,
        notes: notes.trim() || undefined,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        status: 'published',
      });

      // Upload pending image if there is one
      if (hasLocalImage) {
        await uploadPendingImage(recipe.id);
      }

      Alert.alert('Success', 'Recipe saved!', [
        { text: 'View Recipe', onPress: () => navigation.navigate('RecipeDetail', { id: recipe.id }) },
        { text: 'OK' },
      ]);

      setTitle('');
      setDescription('');
      setPrepTime('');
      setCookTime('');
      setIngredients([]);
      setInstructions([]);
      setPrivacyLevel('private');
      setDifficulty('');
      setNotes('');
      setSelectedTagIds([]);
      clearImage();
    } catch (error) {
      Alert.alert('Save Failed', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="px-4 py-4 border-b border-border bg-white">
          <Text className="text-2xl font-semibold text-charcoal">New Recipe</Text>
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

        {/* Import from URL */}
        <View className="p-4">
          <View className="bg-white rounded-xl p-4 border border-border">
            <View className="flex-row items-center mb-3">
              <Ionicons name="link" size={20} color="#C6A664" />
              <Text className="text-charcoal font-medium ml-2">Import from URL</Text>
            </View>
            <View className="flex-row">
              <TextInput
                value={importUrl}
                onChangeText={setImportUrl}
                placeholder="Paste recipe URL..."
                placeholderTextColor="#9A948D"
                className="flex-1 bg-cream rounded-lg px-4 py-3 text-charcoal mr-2"
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity
                onPress={handleImportFromUrl}
                disabled={importing}
                className={`px-4 py-3 rounded-lg ${importing ? 'bg-gold-light' : 'bg-gold'}`}
                activeOpacity={0.8}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="download-outline" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View className="flex-row items-center px-4 mb-4">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-warm-gray text-sm mx-4">or create manually</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        {/* Manual Entry Form */}
        <View className="px-4">
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
                <Text className="flex-1 text-charcoal">{ing.name}</Text>
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

          {/* Notes */}
          <View className="mb-4">
            <Text className="text-charcoal font-medium mb-2">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Tips, variations, or additional notes..."
              placeholderTextColor="#9A948D"
              multiline
              numberOfLines={4}
              className="bg-white border border-border rounded-lg px-4 py-3 text-charcoal"
              style={{ textAlignVertical: 'top', minHeight: 100 }}
            />
          </View>

          {/* Privacy & Difficulty Row */}
          <View className="flex-row mb-4">
            {/* Privacy */}
            <View className="flex-1 mr-2">
              <Text className="text-charcoal font-medium mb-2">Privacy</Text>
              <View className="flex-row bg-white border border-border rounded-lg overflow-hidden">
                <TouchableOpacity
                  onPress={() => setPrivacyLevel('private')}
                  className={`flex-1 py-3 items-center ${privacyLevel === 'private' ? 'bg-gold' : ''}`}
                >
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color={privacyLevel === 'private' ? 'white' : '#9A948D'}
                  />
                  <Text className={`text-xs mt-1 ${privacyLevel === 'private' ? 'text-white' : 'text-warm-gray'}`}>
                    Private
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPrivacyLevel('public')}
                  className={`flex-1 py-3 items-center ${privacyLevel === 'public' ? 'bg-gold' : ''}`}
                >
                  <Ionicons
                    name="globe"
                    size={16}
                    color={privacyLevel === 'public' ? 'white' : '#9A948D'}
                  />
                  <Text className={`text-xs mt-1 ${privacyLevel === 'public' ? 'text-white' : 'text-warm-gray'}`}>
                    Public
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Difficulty */}
            <View className="flex-1 ml-2">
              <Text className="text-charcoal font-medium mb-2">Difficulty</Text>
              <View className="flex-row bg-white border border-border rounded-lg overflow-hidden">
                {(['easy', 'medium', 'hard'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    onPress={() => setDifficulty(difficulty === level ? '' : level)}
                    className={`flex-1 py-3 items-center ${difficulty === level ? 'bg-gold' : ''}`}
                  >
                    <Text
                      className={`text-xs capitalize ${difficulty === level ? 'text-white font-medium' : 'text-warm-gray'}`}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Tags */}
          <View className="mb-4">
            <Text className="text-charcoal font-medium mb-2">Tags</Text>
            <TouchableOpacity
              onPress={() => setShowTagPicker(true)}
              className="bg-white border border-border rounded-lg px-4 py-3"
            >
              {selectedTagIds.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {selectedTagIds.map((tagId) => {
                    const tag = availableTags.find((t) => t.id === tagId);
                    return tag ? (
                      <View key={tagId} className="bg-gold/10 border border-gold/30 rounded-full px-3 py-1 flex-row items-center">
                        <Text className="text-gold text-sm">{tag.name}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              ) : (
                <Text className="text-warm-gray">Tap to add tags...</Text>
              )}
            </TouchableOpacity>
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
              <Text className="text-white font-semibold text-lg">Save Recipe</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Tag Picker Modal */}
      <Modal
        visible={showTagPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTagPicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]" style={{ paddingBottom: insets.bottom }}>
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
              <Text className="text-lg font-semibold text-charcoal">Select Tags</Text>
              <TouchableOpacity onPress={() => setShowTagPicker(false)}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <ScrollView className="px-4 py-4">
              <View className="flex-row flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id));
                        } else {
                          setSelectedTagIds([...selectedTagIds, tag.id]);
                        }
                      }}
                      className={`rounded-full px-4 py-2 border ${
                        isSelected
                          ? 'bg-gold border-gold'
                          : 'bg-white border-border'
                      }`}
                    >
                      <Text
                        className={isSelected ? 'text-white font-medium' : 'text-charcoal'}
                      >
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View className="px-4 py-4 border-t border-border">
              <TouchableOpacity
                onPress={() => setShowTagPicker(false)}
                className="bg-gold py-3 rounded-xl items-center"
              >
                <Text className="text-white font-semibold">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
