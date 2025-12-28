import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Tag } from '@/types';
import { useTags } from '@/hooks/useTags';

interface TagSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  showCategories?: boolean;
}

export default function TagSelector({
  selectedTagIds,
  onTagsChange,
  showCategories = true,
}: TagSelectorProps) {
  const { tags, tagsByCategory, loading, error } = useTags();

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  if (loading) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color="#C6A664" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center py-4">
        <Text className="text-warm-gray text-sm">{error}</Text>
      </View>
    );
  }

  if (tags.length === 0) {
    return (
      <View className="items-center py-4">
        <Text className="text-warm-gray text-sm">No tags available</Text>
      </View>
    );
  }

  if (showCategories) {
    const categories = Object.keys(tagsByCategory).sort();

    return (
      <View>
        {categories.map(category => (
          <View key={category} className="mb-4">
            <Text className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">
              {category}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {tagsByCategory[category].map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => handleToggleTag(tag.id)}
                    className={`flex-row items-center px-3 py-2 rounded-full ${
                      isSelected
                        ? 'bg-gold'
                        : 'bg-cream-dark'
                    }`}
                    activeOpacity={0.8}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      className={`text-sm ${
                        isSelected ? 'text-white font-medium' : 'text-charcoal'
                      }`}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  }

  // Flat list without categories
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 py-1">
        {tags.map(tag => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              onPress={() => handleToggleTag(tag.id)}
              className={`flex-row items-center px-3 py-2 rounded-full ${
                isSelected
                  ? 'bg-gold'
                  : 'bg-cream-dark'
              }`}
              activeOpacity={0.8}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              )}
              <Text
                className={`text-sm ${
                  isSelected ? 'text-white font-medium' : 'text-charcoal'
                }`}
              >
                {tag.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
