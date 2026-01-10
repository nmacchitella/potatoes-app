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
        <button onClick={onGoPrev} className="p-2 text-warm-gray hover:text-charcoal active:bg-cream-dark rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-charcoal">
            {dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {dates[2].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          {offset !== 0 && (
            <button
              onClick={onGoToday}
              className="px-3 py-1 text-xs font-medium text-white bg-gold rounded-full hover:bg-gold-dark active:scale-95 transition-all"
            >
              Today
            </button>
          )}
        </div>
        <button onClick={onGoNext} className="p-2 text-warm-gray hover:text-charcoal active:bg-cream-dark rounded-lg transition-colors">
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
                          {meals.map(meal => {
                            const isCustom = !meal.recipe;
                            const title = isCustom ? meal.custom_title : meal.recipe?.title;
                            return (
                            <div
                              key={meal.id}
                              className={`relative rounded-lg p-2 mb-1 ${isCustom ? 'bg-sage/10 border border-sage/20' : 'bg-cream'}`}
                              onClick={(e) => onToggleMealActions(meal.id, e)}
                            >
                              {isCustom ? (
                                <div className="w-full aspect-video rounded bg-sage/20 flex items-center justify-center mb-1">
                                  <svg className="w-6 h-6 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
                                  </svg>
                                </div>
                              ) : meal.recipe?.cover_image_url ? (
                                <img
                                  src={meal.recipe.cover_image_url}
                                  alt=""
                                  className="w-full aspect-video rounded object-cover mb-1"
                                />
                              ) : null}
                              <p className="text-xs font-medium text-charcoal line-clamp-2">{title}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-warm-gray">{meal.servings} servings</p>
                                {isCustom && <span className="text-[9px] px-1 py-0.5 rounded bg-sage/20 text-sage font-medium">Custom</span>}
                              </div>

                              {/* Mobile Action Menu */}
                              {selectedMealForActions === meal.id && (
                                <div
                                  className="absolute inset-0 bg-charcoal/90 backdrop-blur-sm rounded-lg flex flex-col items-stretch justify-center p-2 z-10"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {!isCustom && meal.recipe && (
                                    <Link
                                      href={`/recipes/${meal.recipe.id}`}
                                      className="flex items-center justify-center gap-1.5 py-2 text-xs text-white hover:text-gold transition-colors"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      View
                                    </Link>
                                  )}
                                  <button
                                    onClick={() => onMove(meal)}
                                    className="flex items-center justify-center gap-1.5 py-2 text-xs text-white hover:text-gold transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    Move
                                  </button>
                                  {!isCustom && (
                                    <button
                                      onClick={(e) => onRepeat(meal, e)}
                                      className="flex items-center justify-center gap-1.5 py-2 text-xs text-white hover:text-gold transition-colors"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Repeat
                                    </button>
                                  )}
                                  <div className="border-t border-white/20 my-1" />
                                  <button
                                    onClick={(e) => onDelete(meal.id, e)}
                                    className="flex items-center justify-center gap-1.5 py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Remove
                                  </button>
                                  <button
                                    onClick={() => onClearMealActions()}
                                    className="mt-1 py-1 text-[10px] text-white/60 hover:text-white/80 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                          })}
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
