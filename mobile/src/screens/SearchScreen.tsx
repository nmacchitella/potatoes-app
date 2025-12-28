import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { RootStackParamList, SearchResponse, SearchRecipeResult, SearchUserResult } from '@/types';
import { searchApi } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SearchResultItem =
  | (SearchRecipeResult & { type: 'my_recipe' | 'discover' })
  | (SearchUserResult & { type: 'user' });

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const data = await searchApi.autocomplete(searchQuery);
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    handleSearch(debouncedQuery);
  }, [debouncedQuery, handleSearch]);

  const hasResults = results && (
    results.my_recipes.length > 0 ||
    results.discover_recipes.length > 0 ||
    results.users.length > 0
  );

  const flatListData: SearchResultItem[] = [
    ...(results?.my_recipes || []).map(r => ({ ...r, type: 'my_recipe' as const })),
    ...(results?.discover_recipes || []).map(r => ({ ...r, type: 'discover' as const })),
    ...(results?.users || []).map(u => ({ ...u, type: 'user' as const })),
  ];

  const renderItem = ({ item }: { item: SearchResultItem }) => {
    if (item.type === 'user') {
      const user = item as SearchUserResult & { type: 'user' };
      return (
        <TouchableOpacity
          onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
          className="flex-row items-center bg-white px-4 py-3 border-b border-border"
        >
          <View className="w-10 h-10 bg-gold rounded-full items-center justify-center mr-3">
            <Text className="text-white font-semibold">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text className="text-charcoal font-medium">{user.name}</Text>
        </TouchableOpacity>
      );
    }

    const recipe = item as SearchRecipeResult & { type: 'my_recipe' | 'discover' };
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('RecipeDetail', { id: recipe.id })}
        className="flex-row items-center bg-white px-4 py-3 border-b border-border"
      >
        {recipe.cover_image_url ? (
          <Image
            source={{ uri: recipe.cover_image_url }}
            style={{ width: 48, height: 48, borderRadius: 8 }}
            contentFit="cover"
          />
        ) : (
          <View className="w-12 h-12 bg-cream-dark rounded-lg items-center justify-center">
            <Ionicons name="restaurant-outline" size={20} color="#9A948D" />
          </View>
        )}
        <View className="flex-1 ml-3">
          <Text className="text-charcoal font-medium" numberOfLines={1}>
            {recipe.title}
          </Text>
          {recipe.type === 'my_recipe' && (
            <Text className="text-warm-gray text-xs">My Recipe</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-cream" style={{ paddingTop: insets.top }}>
      {/* Search Header */}
      <View className="bg-white border-b border-border px-4 py-3 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-2 -ml-2 mr-2"
        >
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center bg-cream rounded-lg px-4">
          <Ionicons name="search" size={18} color="#6B6560" />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              handleSearch(text);
            }}
            placeholder="Search recipes, users..."
            placeholderTextColor="#9A948D"
            className="flex-1 py-3 ml-2 text-charcoal"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#6B6560" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C6A664" />
        </View>
      ) : query.length < 2 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="search" size={48} color="#9A948D" />
          <Text className="text-warm-gray text-center mt-4">
            Search for recipes, users, or ingredients
          </Text>
        </View>
      ) : !hasResults ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="search-outline" size={48} color="#9A948D" />
          <Text className="text-warm-gray text-center mt-4">
            No results found for "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatListData}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}
