import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '@/types';
import { useStore } from '@/store/useStore';
import HomeScreen from '@/screens/HomeScreen';
import AddRecipeScreen from '@/screens/AddRecipeScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import UserAvatar from '@/components/ui/UserAvatar';

const Tab = createBottomTabNavigator<MainTabParamList>();

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useStore();

  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-white border-t border-border flex-row items-center justify-around"
      style={{
        paddingBottom: Math.max(insets.bottom, 12),
        height: 56 + Math.max(insets.bottom, 12),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
      }}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Center button (Add)
        if (route.name === 'Add') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              className="relative -mt-5 items-center justify-center w-14 h-14 bg-gold rounded-full"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8,
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
          );
        }

        // Home button
        if (route.name === 'Home') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              className="flex-col items-center justify-center w-12 h-12"
              activeOpacity={0.7}
            >
              <Ionicons
                name={isFocused ? 'home' : 'home-outline'}
                size={24}
                color={isFocused ? '#C6A664' : '#6B6560'}
              />
              <Text
                className={`text-[10px] mt-0.5 ${
                  isFocused ? 'text-gold' : 'text-warm-gray'
                }`}
              >
                Home
              </Text>
            </TouchableOpacity>
          );
        }

        // Profile button
        if (route.name === 'Profile') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              className="flex-col items-center justify-center w-12 h-12"
              activeOpacity={0.7}
            >
              <UserAvatar user={user} size="sm" />
              <Text
                className={`text-[10px] mt-0.5 ${
                  isFocused ? 'text-gold' : 'text-warm-gray'
                }`}
              >
                Profile
              </Text>
            </TouchableOpacity>
          );
        }

        return null;
      })}
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Add" component={AddRecipeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
