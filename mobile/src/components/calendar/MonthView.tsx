import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { MealPlan, MealType } from '@/types';

interface MonthViewProps {
  loading: boolean;
  getMealsForDate: (date: Date) => MealPlan[];
  isToday: (date: Date) => boolean;
  onDayPress: (date: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Colors matching web frontend MonthView
const MEAL_COLORS: Record<MealType, string> = {
  breakfast: '#FB923C', // orange-400
  lunch: '#4ADE80', // green-400
  dinner: '#60A5FA', // blue-400
  snack: '#FBBF24', // yellow-400
};

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Add padding days from previous month
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push(date);
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add padding days from next month to complete the grid
  const endPadding = 42 - days.length; // 6 rows * 7 days
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

export default function MonthView({
  loading,
  getMealsForDate,
  isToday,
  onDayPress,
}: MonthViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const formatMonthYear = () => {
    return currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === month;
  };

  const getMealIndicators = (date: Date) => {
    const meals = getMealsForDate(date);
    const types = new Set(meals.map(m => m.meal_type));
    return Array.from(types) as MealType[];
  };

  if (loading) {
    return (
      <View className="bg-white rounded-2xl mx-4 p-4 items-center justify-center" style={{ height: 400 }}>
        <ActivityIndicator size="large" color="#C6A664" />
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl mx-4 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <TouchableOpacity onPress={goToPrevMonth} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday}>
          <Text className="text-lg font-semibold text-charcoal">{formatMonthYear()}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goToNextMonth} className="p-2">
          <Ionicons name="chevron-forward" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View className="flex-row border-b border-border">
        {WEEKDAYS.map(day => (
          <View key={day} className="flex-1 py-2 items-center">
            <Text className="text-xs font-medium text-warm-gray">{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View className="flex-row flex-wrap">
        {days.map((date, index) => {
          const isInCurrentMonth = isCurrentMonth(date);
          const isTodayDate = isToday(date);
          const mealTypes = getMealIndicators(date);

          return (
            <TouchableOpacity
              key={index}
              onPress={() => onDayPress(date)}
              className="items-center justify-center"
              style={{ width: '14.285%', height: 52, padding: 2 }}
              activeOpacity={0.7}
            >
              <View
                className={`w-full h-full items-center justify-center rounded-lg ${
                  isTodayDate ? 'bg-gold/20 border border-gold' : ''
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isTodayDate
                      ? 'text-gold-dark'
                      : isInCurrentMonth
                        ? 'text-charcoal'
                        : 'text-warm-gray-light'
                  }`}
                >
                  {date.getDate()}
                </Text>

                {/* Meal indicators */}
                {mealTypes.length > 0 && (
                  <View className="flex-row mt-1 gap-0.5">
                    {mealTypes.slice(0, 3).map(type => (
                      <View
                        key={type}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: MEAL_COLORS[type] }}
                      />
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View className="flex-row justify-center gap-4 p-3 border-t border-border">
        {(Object.entries(MEAL_COLORS) as [MealType, string][]).map(([type, color]) => (
          <View key={type} className="flex-row items-center gap-1">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <Text className="text-xs text-warm-gray capitalize">{type}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
