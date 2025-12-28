import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Collection } from '@/types';
import { collectionApi, getErrorMessage } from '@/lib/api';

interface AddToCollectionModalProps {
  visible: boolean;
  recipeId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddToCollectionModal({
  visible,
  recipeId,
  onClose,
  onSuccess,
}: AddToCollectionModalProps) {
  const insets = useSafeAreaInsets();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [recipeCollectionIds, setRecipeCollectionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Create new collection
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, recipeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allCollections, recipeCollections] = await Promise.all([
        collectionApi.list(),
        collectionApi.getForRecipe(recipeId),
      ]);
      setCollections(allCollections);
      setRecipeCollectionIds(new Set(recipeCollections.map(c => c.id)));
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCollection = async (collectionId: string) => {
    const isInCollection = recipeCollectionIds.has(collectionId);
    setSaving(collectionId);

    try {
      if (isInCollection) {
        await collectionApi.removeRecipe(collectionId, recipeId);
        setRecipeCollectionIds(prev => {
          const next = new Set(prev);
          next.delete(collectionId);
          return next;
        });
        // Update recipe count
        setCollections(prev => prev.map(c =>
          c.id === collectionId ? { ...c, recipe_count: c.recipe_count - 1 } : c
        ));
      } else {
        await collectionApi.addRecipe(collectionId, recipeId);
        setRecipeCollectionIds(prev => new Set([...prev, collectionId]));
        // Update recipe count
        setCollections(prev => prev.map(c =>
          c.id === collectionId ? { ...c, recipe_count: c.recipe_count + 1 } : c
        ));
      }
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    setCreatingCollection(true);
    try {
      const newCollection = await collectionApi.create({ name: newCollectionName.trim() });
      // Add recipe to the new collection
      await collectionApi.addRecipe(newCollection.id, recipeId);
      setCollections(prev => [...prev, { ...newCollection, recipe_count: 1 }]);
      setRecipeCollectionIds(prev => new Set([...prev, newCollection.id]));
      setNewCollectionName('');
      setIsCreating(false);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleClose = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-border">
          <Text className="text-lg font-semibold text-charcoal">Add to Collection</Text>
          <TouchableOpacity onPress={handleClose} className="p-2 -mr-2">
            <Ionicons name="close" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#C6A664" />
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            {/* Create New Collection */}
            <View className="p-4 border-b border-border">
              {isCreating ? (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={newCollectionName}
                    onChangeText={setNewCollectionName}
                    placeholder="Collection name..."
                    placeholderTextColor="#9A948D"
                    className="flex-1 bg-white px-4 py-3 rounded-lg border border-border text-charcoal"
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={handleCreateCollection}
                    disabled={creatingCollection || !newCollectionName.trim()}
                    className="p-3 bg-gold rounded-lg"
                  >
                    {creatingCollection ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsCreating(false);
                      setNewCollectionName('');
                    }}
                    className="p-3 bg-cream-dark rounded-lg"
                  >
                    <Ionicons name="close" size={20} color="#6B6560" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsCreating(true)}
                  className="flex-row items-center gap-3 py-2"
                >
                  <View className="w-10 h-10 rounded-lg bg-gold/10 items-center justify-center">
                    <Ionicons name="add" size={24} color="#C6A664" />
                  </View>
                  <Text className="text-gold font-medium">Create new collection</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Collections List */}
            <View className="py-2">
              {collections.length === 0 ? (
                <View className="items-center py-8">
                  <Text className="text-warm-gray">No collections yet</Text>
                </View>
              ) : (
                collections.map(collection => {
                  const isInCollection = recipeCollectionIds.has(collection.id);
                  const isSaving = saving === collection.id;

                  return (
                    <TouchableOpacity
                      key={collection.id}
                      onPress={() => handleToggleCollection(collection.id)}
                      disabled={isSaving}
                      className="flex-row items-center justify-between px-4 py-4 border-b border-border bg-white"
                    >
                      <View className="flex-1 mr-4">
                        <Text className="text-charcoal font-medium" numberOfLines={1}>
                          {collection.name}
                        </Text>
                        <Text className="text-sm text-warm-gray">
                          {collection.recipe_count} {collection.recipe_count === 1 ? 'recipe' : 'recipes'}
                        </Text>
                      </View>

                      {isSaving ? (
                        <ActivityIndicator size="small" color="#C6A664" />
                      ) : (
                        <View
                          className={`w-6 h-6 rounded-md items-center justify-center ${
                            isInCollection ? 'bg-gold' : 'border-2 border-border'
                          }`}
                        >
                          {isInCollection && (
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
