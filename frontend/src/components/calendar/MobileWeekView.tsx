'use client';

import Link from 'next/link';
import type { MealPlan, MealType } from '@/types';
import MealCard from './MealCard';

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

interface MobileWeekViewProps {
  dates: Date[]; // 3-day dates
  offset: number;
  loading: boolean;
  selectedMealForActions: string | null;
  getMealsForDate: (date: Date) => MealPlan[];
  getMealsForSlot: (date: Date, mealType: MealType) => MealPlan[];
  isToday: (date: Date) => boolean;
  isPast: (date: Date) => boolean;
  onGoPrev: () => void;
  onGoNext: () => void;
  onGoToday: () => void;
  onToggleMealActions: (mealId: string, e: React.MouseEvent) => void;
  onClearMealActions: () => void;
  onMove: (meal: MealPlan) => void;
  onRepeat: (meal: MealPlan, e: React.MouseEvent) => void;
  onDelete: (mealId: string, e: React.MouseEvent) => void;
  onSlotClick: (date: Date, mealType: MealType) => void;
}

export default function MobileWeekView({
  dates,
  offset,
  loading,
  selectedMealForActions,
  getMealsForDate,
  getMealsForSlot,
  isToday,
  isPast,
  onGoPrev,
  onGoNext,
  onGoToday,
  onToggleMealActions,
  onClearMealActions,
  onMove,
  onRepeat,
  onDelete,
  onSlotClick,
}: MobileWeekViewProps) {
  return (
    <div className="md:hidden">
      {/* Mobile Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onGoPrev} className="p-2 text-warm-gray hover:text-charcoal">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <span className="text-sm font-medium text-charcoal">
            {dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {dates[2].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          {offset !== 0 && (
            <button onClick={onGoToday} className="ml-2 text-xs text-gold">
              Today
            </button>
          )}
        </div>
        <button onClick={onGoNext} className="p-2 text-warm-gray hover:text-charcoal">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 3-Day Grid */}
      <div className="grid grid-cols-3 gap-2">
        {dates.map((date, index) => {
          const dayMeals = getMealsForDate(date);
          const past = isPast(date);
          const today = isToday(date);

          return (
            <div
              key={index}
              className={`bg-white rounded-xl border overflow-hidden ${
                today ? 'border-gold' : 'border-border'
              }`}
            >
              {/* Day Header */}
              <div className={`px-2 py-2 text-center border-b ${
                today ? 'bg-gold/10 border-gold/30' : past ? 'bg-gray-50 border-border' : 'border-border'
              }`}>
                <div className={`text-xs uppercase tracking-wide ${
                  past ? 'text-gray-400' : 'text-warm-gray'
                }`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-serif ${
                  today ? 'text-gold-dark font-semibold' : past ? 'text-gray-400' : 'text-charcoal'
                }`}>
                  {date.getDate()}
                </div>
              </div>

              {/* Meals for this day */}
              <div className="p-2 space-y-2 min-h-[200px]">
                {loading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="bg-cream-dark rounded h-16" />
                    <div className="bg-cream-dark rounded h-16" />
                  </div>
                ) : dayMeals.length > 0 ? (
                  <>
                    {MEAL_TYPES.map(({ key: mealType, label }) => {
                      const meals = getMealsForSlot(date, mealType);
                      if (meals.length === 0) return null;
                      return (
                        <div key={mealType}>
                          <div className="text-[10px] text-warm-gray uppercase mb-1">{label}</div>
                          {meals.map(meal => (
                            <div
                              key={meal.id}
                              className="relative rounded-lg bg-cream p-2 mb-1"
                              onClick={(e) => onToggleMealActions(meal.id, e)}
                            >
                              {meal.recipe.cover_image_url && (
                                <img
                                  src={meal.recipe.cover_image_url}
                                  alt=""
                                  className="w-full aspect-video rounded object-cover mb-1"
                                />
                              )}
                              <p className="text-xs font-medium text-charcoal line-clamp-2">{meal.recipe.title}</p>
                              <p className="text-[10px] text-warm-gray">{meal.servings} servings</p>

                              {/* Mobile Action Menu */}
                              {selectedMealForActions === meal.id && (
                                <div className="absolute inset-0 bg-white/95 rounded-lg flex flex-col items-center justify-center gap-2 z-10">
                                  <Link
                                    href={`/recipes/${meal.recipe.id}`}
                                    className="text-xs text-charcoal hover:text-gold"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Recipe
                                  </Link>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onMove(meal); }}
                                    className="text-xs text-charcoal hover:text-gold"
                                  >
                                    Move to...
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onRepeat(meal, e); }}
                                    className="text-xs text-charcoal hover:text-gold"
                                  >
                                    Repeat
                                  </button>
                                  <button
                                    onClick={(e) => onDelete(meal.id, e)}
                                    className="text-xs text-red-500"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onClearMealActions(); }}
                                    className="text-[10px] text-warm-gray mt-1"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="h-full flex flex-col justify-center">
                    {MEAL_TYPES.map(({ key: mealType, label }) => (
                      <button
                        key={mealType}
                        onClick={() => onSlotClick(date, mealType)}
                        className="text-[10px] text-warm-gray hover:text-gold py-2 border-b border-border last:border-b-0"
                      >
                        + {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Add button when there are meals */}
                {dayMeals.length > 0 && (
                  <button
                    onClick={() => onSlotClick(date, 'dinner')}
                    className="w-full py-1 text-[10px] text-warm-gray hover:text-gold border-t border-border mt-2"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
