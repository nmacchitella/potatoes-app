'use client';

import Link from 'next/link';
import type { MealPlan, MealType } from '@/types';

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

interface DayViewProps {
  date: Date;
  loading: boolean;
  getMealsForSlot: (date: Date, mealType: MealType) => MealPlan[];
  isToday: (date: Date) => boolean;
  isPast: (date: Date) => boolean;
  onRepeat: (meal: MealPlan, e: React.MouseEvent) => void;
  onDelete: (mealId: string, e: React.MouseEvent) => void;
  onSlotClick: (date: Date, mealType: MealType) => void;
}

export default function DayView({
  date,
  loading,
  getMealsForSlot,
  isToday,
  isPast,
  onRepeat,
  onDelete,
  onSlotClick,
}: DayViewProps) {
  const today = isToday(date);
  const past = isPast(date);

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden max-w-2xl mx-auto">
      <div className={`px-6 py-4 border-b border-border ${today ? 'bg-gold/10' : past ? 'bg-gray-50' : ''}`}>
        <div className={`text-2xl font-serif ${today ? 'text-gold-dark' : past ? 'text-gray-400' : 'text-charcoal'}`}>
          {date.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
        <div className={`text-sm ${past ? 'text-gray-400' : 'text-warm-gray'}`}>
          {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {MEAL_TYPES.map(({ key: mealType, label }) => {
        const meals = getMealsForSlot(date, mealType);
        return (
          <div key={mealType} className="border-b border-border last:border-b-0">
            <div className="px-6 py-3 bg-cream-dark">
              <span className="text-sm font-medium text-charcoal">{label}</span>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="animate-pulse bg-cream-dark rounded-lg h-16" />
              ) : meals.length > 0 ? (
                <div className="space-y-2">
                  {meals.map(meal => (
                    <div key={meal.id} className="flex items-center gap-3 p-2 rounded-lg bg-cream">
                      {meal.recipe.cover_image_url && (
                        <img src={meal.recipe.cover_image_url} alt="" className="w-12 h-12 rounded object-cover" />
                      )}
                      <div className="flex-1">
                        <Link href={`/recipes/${meal.recipe.id}`} className="font-medium text-charcoal hover:text-gold text-sm">
                          {meal.recipe.title}
                        </Link>
                        <div className="text-xs text-warm-gray">{meal.servings} servings</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => onRepeat(meal, e)} className="text-warm-gray hover:text-blue-500" title="Repeat weekly">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button onClick={(e) => onDelete(meal.id, e)} className="text-warm-gray hover:text-red-500" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => onSlotClick(date, mealType)}
                  className="w-full py-6 border-2 border-dashed border-border rounded-lg text-warm-gray hover:border-gold hover:text-gold transition-colors"
                >
                  + Add {label.toLowerCase()}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
