import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Tag } from '@/types';
import { useTags } from '@/hooks/useTags';

interface TagFilterBarProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export default function TagFilterBar({
  selectedTagIds,
  onTagsChange,
}: TagFilterBarProps) {
  const { tags, loading } = useTags();

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  if (loading) {
    return (
      <View className="h-12 justify-center px-4">
        <ActivityIndicator size="small" color="#C6A664" />
      </View>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <View className="border-b border-border bg-cream">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
      >
        {/* Clear All Button - only show when tags are selected */}
        {selectedTagIds.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            className="flex-row items-center px-3 py-1.5 rounded-full bg-cream-dark mr-2"
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={14} color="#6B6560" />
            <Text className="text-warm-gray text-sm ml-1">Clear</Text>
          </TouchableOpacity>
        )}

        {tags.map(tag => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              onPress={() => handleToggleTag(tag.id)}
              className={`flex-row items-center px-3 py-1.5 rounded-full mr-2 ${
                isSelected
                  ? 'bg-gold'
                  : 'bg-cream-dark'
              }`}
              activeOpacity={0.8}
            >
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
      </ScrollView>
    </View>
  );
}
