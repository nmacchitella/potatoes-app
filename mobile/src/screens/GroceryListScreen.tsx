import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Share, Modal
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GroceryListItem, RootStackParamList } from '@/types';
import { useGroceryList, CATEGORY_LABELS } from '@/hooks/useGroceryList';
import { groceryListApi } from '@/lib/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Category Section Component
function CategorySection({
  category,
  items,
  defaultCollapsed = false,
  onToggleChecked,
  onToggleStaple,
  onDelete,
  onItemPress,
}: {
  category: string;
  items: GroceryListItem[];
  defaultCollapsed?: boolean;
  onToggleChecked: (itemId: string) => void;
  onToggleStaple: (itemId: string, isStaple: boolean) => void;
  onDelete: (itemId: string) => void;
  onItemPress: (item: GroceryListItem) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const checkedCount = items.filter(i => i.is_checked).length;
  const totalCount = items.length;
  const label = CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);

  if (items.length === 0) return null;

  return (
    <View className="mb-3">
      {/* Category header */}
      <TouchableOpacity
        onPress={() => setIsCollapsed(!isCollapsed)}
        className="flex-row items-center justify-between py-2 px-3 bg-cream rounded-lg"
        activeOpacity={0.7}
      >
        <View className="flex-row items-center">
          <Ionicons
            name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
            size={16}
            color="#6B6560"
          />
          <Text className="text-sm font-medium text-charcoal ml-2">{label}</Text>
        </View>
        <Text className="text-xs text-warm-gray">
          {checkedCount}/{totalCount}
        </Text>
      </TouchableOpacity>

      {/* Items list */}
      {!isCollapsed && (
        <View className="mt-1">
          {items.map(item => (
            <GroceryItemRow
              key={item.id}
              item={item}
              onToggleChecked={onToggleChecked}
              onToggleStaple={onToggleStaple}
              onDelete={onDelete}
              onPress={onItemPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// Individual Grocery Item Row
function GroceryItemRow({
  item,
  onToggleChecked,
  onToggleStaple,
  onDelete,
  onPress,
}: {
  item: GroceryListItem;
  onToggleChecked: (itemId: string) => void;
  onToggleStaple: (itemId: string, isStaple: boolean) => void;
  onDelete: (itemId: string) => void;
  onPress: (item: GroceryListItem) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasRecipes = item.source_recipes && item.source_recipes.length > 0;

  const formatQuantity = () => {
    if (!item.quantity) return null;
    const qty = item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1);
    return item.unit ? `${qty} ${item.unit}` : String(qty);
  };

  const quantity = formatQuantity();

  return (
    <View className={`rounded-lg ${item.is_checked ? 'bg-warm-gray/10' : ''}`}>
      <View className="flex-row items-center py-2 px-2">
        {/* Checkbox */}
        <TouchableOpacity
          onPress={() => onToggleChecked(item.id)}
          className={`w-6 h-6 rounded border items-center justify-center ${
            item.is_checked
              ? 'bg-gold border-gold'
              : 'border-warm-gray/50'
          }`}
        >
          {item.is_checked && (
            <Ionicons name="checkmark" size={16} color="white" />
          )}
        </TouchableOpacity>

        {/* Item name and quantity */}
        <TouchableOpacity
          onPress={() => hasRecipes && setIsExpanded(!isExpanded)}
          className="flex-1 flex-row items-center ml-3"
          disabled={!hasRecipes}
        >
          {hasRecipes && (
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color="#9A948D"
            />
          )}
          <Text
            className={`text-sm flex-1 ${hasRecipes ? 'ml-1' : ''} ${
              item.is_checked ? 'text-warm-gray line-through' : 'text-charcoal'
            }`}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {quantity && (
            <Text className="text-xs text-warm-gray ml-2">{quantity}</Text>
          )}
          {hasRecipes && !isExpanded && (
            <Text className="text-[10px] text-warm-gray/60 ml-1">
              ({item.source_recipes.length})
            </Text>
          )}
        </TouchableOpacity>

        {/* Actions */}
        <View className="flex-row items-center ml-2">
          {/* Pantry toggle */}
          <TouchableOpacity
            onPress={() => onToggleStaple(item.id, !item.is_staple)}
            className="p-2"
          >
            <Ionicons
              name={item.is_staple ? 'home' : 'home-outline'}
              size={18}
              color={item.is_staple ? '#C6A664' : '#9A948D'}
            />
          </TouchableOpacity>

          {/* Delete button */}
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            className="p-2"
          >
            <Ionicons name="close" size={18} color="#9A948D" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded recipes list */}
      {isExpanded && hasRecipes && (
        <View className="pl-10 pr-2 pb-2">
          {item.source_recipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              onPress={() => onPress(item)}
              className="flex-row items-center py-1"
            >
              <Ionicons name="document-text-outline" size={14} color="#6B6560" />
              <Text className="text-xs text-warm-gray ml-2" numberOfLines={1}>
                {recipe.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Add Item Form Component
function AddItemForm({
  onAddItem,
}: {
  onAddItem: (name: string, quantity?: number, unit?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsAdding(true);
    try {
      await onAddItem(
        name.trim(),
        quantity ? parseFloat(quantity) : undefined,
        unit.trim() || undefined
      );
      setName('');
      setQuantity('');
      setUnit('');
      setShowExpanded(false);
    } catch (err) {
      console.error('Failed to add item:', err);
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View className="mb-4">
      <View className="flex-row gap-2">
        <View className="flex-1 flex-row bg-white border border-border rounded-lg overflow-hidden">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Add item..."
            placeholderTextColor="#9A948D"
            className="flex-1 px-4 py-3 text-charcoal"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {name.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowExpanded(!showExpanded)}
              className="px-3 items-center justify-center"
            >
              <Ionicons
                name={showExpanded ? 'chevron-up' : 'options-outline'}
                size={20}
                color="#6B6560"
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!name.trim() || isAdding}
          className={`px-4 rounded-lg items-center justify-center ${
            !name.trim() || isAdding ? 'bg-gold/50' : 'bg-gold'
          }`}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-medium">Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Expanded form */}
      {showExpanded && (
        <View className="mt-2 flex-row gap-2">
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Qty"
            placeholderTextColor="#9A948D"
            keyboardType="decimal-pad"
            className="w-20 px-3 py-2 bg-white border border-border rounded-lg text-charcoal"
          />
          <TextInput
            value={unit}
            onChangeText={setUnit}
            placeholder="Unit (cups, lbs...)"
            placeholderTextColor="#9A948D"
            className="flex-1 px-3 py-2 bg-white border border-border rounded-lg text-charcoal"
          />
        </View>
      )}
    </View>
  );
}

// Generate Modal Component
function GenerateModal({
  visible,
  onClose,
  onGenerate,
  isGenerating,
  hasExistingItems,
}: {
  visible: boolean;
  onClose: () => void;
  onGenerate: (startDate: string, endDate: string, merge: boolean) => Promise<void>;
  isGenerating: boolean;
  hasExistingItems: boolean;
}) {
  const [daysAhead, setDaysAhead] = useState(7);
  const [mergeItems, setMergeItems] = useState(true);

  if (!visible) return null;

  const handleGenerate = async () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    try {
      await onGenerate(formatDate(today), formatDate(endDate), mergeItems);
      onClose();
    } catch (err) {
      Alert.alert('Error', 'Failed to generate grocery list');
    }
  };

  return (
    <View className="absolute inset-0 bg-black/50 items-center justify-center z-50">
      <View className="bg-white rounded-2xl mx-6 p-6 w-full max-w-sm">
        <Text className="text-lg font-semibold text-charcoal mb-4">
          Generate from Meal Plan
        </Text>

        <Text className="text-sm text-warm-gray mb-2">Days ahead</Text>
        <View className="flex-row mb-4">
          {[3, 7, 14].map((days) => (
            <TouchableOpacity
              key={days}
              onPress={() => setDaysAhead(days)}
              className={`flex-1 py-2 mx-1 rounded-lg border ${
                daysAhead === days
                  ? 'bg-gold border-gold'
                  : 'bg-white border-border'
              }`}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  daysAhead === days ? 'text-white' : 'text-charcoal'
                }`}
              >
                {days} days
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {hasExistingItems && (
          <TouchableOpacity
            onPress={() => setMergeItems(!mergeItems)}
            className="flex-row items-center py-3 mb-4"
          >
            <View
              className={`w-5 h-5 rounded border mr-3 items-center justify-center ${
                mergeItems ? 'bg-gold border-gold' : 'border-warm-gray/50'
              }`}
            >
              {mergeItems && <Ionicons name="checkmark" size={14} color="white" />}
            </View>
            <Text className="text-sm text-charcoal flex-1">
              Keep existing items (merge)
            </Text>
          </TouchableOpacity>
        )}

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={onClose}
            className="flex-1 py-3 border border-border rounded-lg"
          >
            <Text className="text-center text-charcoal font-medium">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={isGenerating}
            className={`flex-1 py-3 rounded-lg ${isGenerating ? 'bg-gold/50' : 'bg-gold'}`}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-center text-white font-medium">Generate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Share Modal Component
function ShareModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const generateLink = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const { share_token } = await groceryListApi.getOrCreateShareLink();
      const link = `https://potatoes.recipes/grocery/share/${share_token}`;
      setShareLink(link);
    } catch (err) {
      console.error('Failed to generate share link:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (shareLink) {
      await Clipboard.setStringAsync(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (shareLink) {
      try {
        await Share.share({
          message: `Check out my grocery list: ${shareLink}`,
          url: shareLink,
        });
      } catch (err) {
        console.error('Failed to share:', err);
      }
    }
  };

  // Generate link when modal opens
  const handleOpen = () => {
    if (!shareLink && !isLoading) {
      generateLink();
    }
  };

  if (!visible) return null;

  // Trigger link generation on first render when visible
  if (visible && !shareLink && !isLoading && !error) {
    handleOpen();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 items-center justify-center">
        <View className="bg-white rounded-2xl mx-6 p-5 w-full max-w-sm">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-charcoal">
              Share grocery list
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={22} color="#6B6560" />
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-warm-gray mb-4">
            Anyone with this link can view your grocery list
          </Text>

          {isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color="#C6A664" />
              <Text className="text-sm text-warm-gray mt-2">Generating link...</Text>
            </View>
          ) : error ? (
            <View className="items-center py-4">
              <Text className="text-sm text-red-500 mb-3">Failed to generate link</Text>
              <TouchableOpacity
                onPress={generateLink}
                className="px-4 py-2 bg-gold rounded-lg"
              >
                <Text className="text-white font-medium">Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : shareLink ? (
            <>
              <View className="bg-cream border border-border rounded-lg p-3 mb-4">
                <Text className="text-sm text-charcoal" numberOfLines={2}>
                  {shareLink}
                </Text>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCopy}
                  className={`flex-1 py-3 rounded-lg items-center ${
                    copied ? 'bg-green-100' : 'bg-cream border border-border'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name={copied ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color={copied ? '#16a34a' : '#6B6560'}
                    />
                    <Text className={`ml-2 font-medium ${copied ? 'text-green-600' : 'text-charcoal'}`}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  className="flex-1 py-3 bg-gold rounded-lg items-center"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="share-outline" size={18} color="white" />
                    <Text className="text-white font-medium ml-2">Share</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// Main Screen Component
export default function GroceryListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const {
    groceryList,
    loading,
    error,
    toggleItemChecked,
    toggleItemStaple,
    addItem,
    deleteItem,
    clearCheckedItems,
    clearAllItems,
    isGenerating,
    generateFromMealPlan,
    getAllCategories,
    refresh,
  } = useGroceryList();

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleAddItem = async (name: string, quantity?: number, unit?: string) => {
    await addItem({ name, quantity, unit });
  };

  const handleItemPress = (item: GroceryListItem) => {
    if (item.source_recipes && item.source_recipes.length > 0) {
      navigation.navigate('RecipeDetail', { id: item.source_recipes[0].id });
    }
  };

  const handleClearChecked = () => {
    Alert.alert(
      'Clear Checked Items',
      'Remove all checked items from the list?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearCheckedItems },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Items',
      'Remove all items from the grocery list?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearAllItems },
      ]
    );
  };

  const hasItems = groceryList && groceryList.items.length > 0;
  const hasCheckedItems = groceryList?.items.some(i => i.is_checked) || false;
  const checkedCount = groceryList?.items.filter(i => i.is_checked).length || 0;
  const totalCount = groceryList?.items.length || 0;
  const categories = getAllCategories();

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-cream items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#C6A664" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream items-center justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-red-500">{error}</Text>
        <TouchableOpacity onPress={refresh} className="mt-4">
          <Text className="text-gold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-border px-4 py-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-semibold text-charcoal">Grocery List</Text>
          {hasItems && (
            <Text className="text-xs text-warm-gray mt-0.5">
              {checkedCount} of {totalCount} items checked
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setShowGenerateModal(true)}
            className="flex-row items-center bg-gold px-3 py-2 rounded-lg"
          >
            <Ionicons name="refresh" size={16} color="white" />
            <Text className="text-white font-medium ml-1 text-sm">Generate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowShareModal(true)}
            className="p-2"
          >
            <Ionicons name="share-outline" size={22} color="#6B6560" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#C6A664"
          />
        }
      >
        {/* Add item form */}
        <AddItemForm onAddItem={handleAddItem} />

        {/* Empty state */}
        {!hasItems && (
          <View className="items-center py-12 border border-dashed border-border rounded-xl">
            <Ionicons name="list-outline" size={48} color="#9A948D" />
            <Text className="text-lg font-medium text-charcoal mt-4">
              Your grocery list is empty
            </Text>
            <Text className="text-warm-gray text-center mt-2 px-8">
              Add items manually or generate from your meal plan
            </Text>
            <TouchableOpacity
              onPress={() => setShowGenerateModal(true)}
              className="flex-row items-center bg-gold px-4 py-2 rounded-lg mt-4"
            >
              <Ionicons name="refresh" size={16} color="white" />
              <Text className="text-white font-medium ml-2">Generate from Meal Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Items by category */}
        {hasItems && groceryList && (
          <>
            {categories.map(category => (
              <CategorySection
                key={category}
                category={category}
                items={groceryList.items_by_category[category] || []}
                defaultCollapsed={category === 'staples'}
                onToggleChecked={toggleItemChecked}
                onToggleStaple={toggleItemStaple}
                onDelete={deleteItem}
                onItemPress={handleItemPress}
              />
            ))}

            {/* Clear buttons */}
            <View className="flex-row justify-end gap-4 mt-6 pt-4 border-t border-border">
              {hasCheckedItems && (
                <TouchableOpacity onPress={handleClearChecked}>
                  <Text className="text-sm text-warm-gray">Clear checked</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClearAll}>
                <Text className="text-sm text-red-500">Clear all</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Generate modal */}
      <GenerateModal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={generateFromMealPlan}
        isGenerating={isGenerating}
        hasExistingItems={hasItems || false}
      />

      {/* Share modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </View>
  );
}
