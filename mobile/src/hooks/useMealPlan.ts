import { useState, useEffect, useCallback, useMemo } from 'react';
import type { MealPlan, MealType } from '@/types';
import { mealPlanApi } from '@/lib/api';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function useMealPlan() {
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0); // Days from today

  // Calculate the 3-day window
  const dates = useMemo(() => {
    const today = startOfDay(new Date());
    const start = addDays(today, offset);
    return [start, addDays(start, 1), addDays(start, 2)];
  }, [offset]);

  const startDate = dates[0];
  const endDate = dates[2];

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mealPlanApi.list(
        formatDate(startDate),
        formatDate(endDate)
      );
      setMeals(response.items);
    } catch (error) {
      console.error('Failed to fetch meal plans:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const isToday = useCallback((date: Date) => {
    const today = startOfDay(new Date());
    return formatDate(date) === formatDate(today);
  }, []);

  const isPast = useCallback((date: Date) => {
    const today = startOfDay(new Date());
    return date < today;
  }, []);

  const getMealsForDate = useCallback(
    (date: Date) => {
      const dateStr = formatDate(date);
      return meals.filter((m) => m.planned_date === dateStr);
    },
    [meals]
  );

  const getMealsForSlot = useCallback(
    (date: Date, mealType: MealType) => {
      const dateStr = formatDate(date);
      return meals.filter(
        (m) => m.planned_date === dateStr && m.meal_type === mealType
      );
    },
    [meals]
  );

  const goNext = useCallback(() => {
    setOffset((prev) => prev + 3);
  }, []);

  const goPrev = useCallback(() => {
    setOffset((prev) => prev - 3);
  }, []);

  const goToday = useCallback(() => {
    setOffset(0);
  }, []);

  const deleteMeal = useCallback(async (mealId: string) => {
    try {
      await mealPlanApi.delete(mealId);
      setMeals((prev) => prev.filter((m) => m.id !== mealId));
      return true;
    } catch (error) {
      console.error('Failed to delete meal:', error);
      return false;
    }
  }, []);

  const addMeal = useCallback(
    async (recipeId: string, date: Date, mealType: MealType, servings = 2) => {
      try {
        const newMeal = await mealPlanApi.create({
          recipe_id: recipeId,
          planned_date: formatDate(date),
          meal_type: mealType,
          servings,
        });
        setMeals((prev) => [...prev, newMeal]);
        return newMeal;
      } catch (error) {
        console.error('Failed to add meal:', error);
        return null;
      }
    },
    []
  );

  return {
    meals,
    loading,
    dates,
    offset,
    isToday,
    isPast,
    getMealsForDate,
    getMealsForSlot,
    goNext,
    goPrev,
    goToday,
    deleteMeal,
    addMeal,
    refresh: fetchMeals,
  };
}
