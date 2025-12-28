import { View, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '@/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface TopBarProps {
  showMenuButton?: boolean;
  onMenuPress?: () => void;
}

export default function TopBar({ showMenuButton = true, onMenuPress }: TopBarProps) {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-cream border-b border-border flex-row items-center px-4"
      style={{ paddingTop: insets.top, height: 56 + insets.top }}
    >
      {/* Menu Button */}
      {showMenuButton && (
        <TouchableOpacity
          onPress={onMenuPress}
          className="p-2 -ml-2 mr-2"
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      )}

      {/* Search Bar */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Search')}
        className="flex-1 flex-row items-center bg-white border border-border rounded-full px-4 py-2"
        activeOpacity={0.7}
      >
        <Ionicons name="search" size={16} color="#6B6560" />
        <TextInput
          placeholder="Search..."
          placeholderTextColor="#6B6560"
          className="flex-1 ml-2 text-charcoal text-sm"
          editable={false}
          pointerEvents="none"
        />
      </TouchableOpacity>

      {/* Notifications */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Notifications')}
        className="p-2 ml-2"
        activeOpacity={0.7}
      >
        <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
      </TouchableOpacity>
    </View>
  );
}
