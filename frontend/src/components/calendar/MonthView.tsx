'use client';

import Link from 'next/link';
import type { MealPlan, MealType } from '@/types';
import { formatDateForApi } from '@/lib/calendar-utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

interface MonthViewProps {
  monthDates: Date[];
  currentDate: Date;
  loading: boolean;
  selectedMealForActions: string | null;
  mobileSelectedDate: Date | null;
  getMealsForDate: (date: Date) => MealPlan[];
  getMealsForSlot: (date: Date, mealType: MealType) => MealPlan[];
  isToday: (date: Date) => boolean;
  isPast: (date: Date) => boolean;
  isSameMonth: (date1: Date, date2: Date) => boolean;
  onSlotClick: (date: Date, mealType: MealType) => void;
  onSelectMobileDate: (date: Date | null) => void;
  onToggleMealActions: (mealId: string, e: React.MouseEvent) => void;
  onClearMealActions: () => void;
  onMove: (meal: MealPlan) => void;
  onRepeat: (meal: MealPlan, e: React.MouseEvent) => void;
  onDelete: (mealId: string, e: React.MouseEvent) => void;
}

export default function MonthView({
  monthDates,
  currentDate,
  loading,
  selectedMealForActions,
  mobileSelectedDate,
  getMealsForDate,
  getMealsForSlot,
  isToday,
  isPast,
  isSameMonth,
  onSlotClick,
  onSelectMobileDate,
  onToggleMealActions,
  onClearMealActions,
  onMove,
  onRepeat,
  onDelete,
}: MonthViewProps) {
  return (
    <>
      {/* Desktop Month View */}
      <div className="hidden md:block bg-white rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map(day => (
            <div key={day} className="px-2 py-2 text-center border-r border-border last:border-r-0">
              <div className="text-xs text-warm-gray uppercase tracking-wide">{day}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthDates.map((date, index) => {
            const meals = getMealsForDate(date);
            const inCurrentMonth = isSameMonth(date, currentDate);
            const past = isPast(date);
            return (
              <div
                key={index}
                className={`min-h-[100px] p-1 border-r border-b border-border ${
                  index % 7 === 6 ? 'border-r-0' : ''
                } ${isToday(date) ? 'bg-gold/10' : !inCurrentMonth ? 'bg-gray-100' : past ? 'bg-gray-50' : ''}`}
              >
                <div className={`text-xs font-medium mb-1 ${
                  isToday(date) ? 'text-gold-dark' : !inCurrentMonth ? 'text-gray-400' : past ? 'text-gray-400' : 'text-charcoal'
                }`}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {meals.slice(0, 3).map(meal => (
                    <div
                      key={meal.id}
                      className={`text-[10px] px-1 py-0.5 rounded truncate ${
                        meal.meal_type === 'breakfast' ? 'bg-orange-100 text-orange-800' :
                        meal.meal_type === 'lunch' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}
                      title={meal.recipe.title}
                    >
                      {meal.recipe.title}
                    </div>
                  ))}
                  {meals.length > 3 && (
                    <div className="text-[10px] text-warm-gray">+{meals.length - 3} more</div>
                  )}
                </div>
                {meals.length === 0 && inCurrentMonth && (
                  <button
                    onClick={() => onSlotClick(date, 'dinner')}
                    className="w-full h-12 flex items-center justify-center text-gray-300 hover:text-gold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Month View (Mini Calendar + Day Detail) */}
      <div className="md:hidden space-y-4">
        {/* Mini Calendar */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(day => (
              <div key={day} className="py-2 text-center">
                <div className="text-[10px] text-warm-gray uppercase">{day.charAt(0)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDates.map((date, index) => {
              const meals = getMealsForDate(date);
              const inCurrentMonth = isSameMonth(date, currentDate);
              const past = isPast(date);
              const isSelected = mobileSelectedDate && formatDateForApi(date) === formatDateForApi(mobileSelectedDate);
              const todayDate = isToday(date);

              return (
                <button
                  key={index}
                  onClick={() => onSelectMobileDate(date)}
                  className={`aspect-square p-1 flex flex-col items-center justify-center relative ${
                    !inCurrentMonth ? 'opacity-40' : ''
                  }`}
                >
                  <span className={`text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                    isSelected ? 'bg-gold text-white' :
                    todayDate ? 'bg-gold/20 text-gold-dark' :
                    past ? 'text-gray-400' : 'text-charcoal'
                  }`}>
                    {date.getDate()}
                  </span>
                  {/* Meal dots */}
                  {meals.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {meals.slice(0, 3).map((meal, i) => (
                        <div
                          key={i}
                          className={`w-1 h-1 rounded-full ${
                            meal.meal_type === 'breakfast' ? 'bg-orange-400' :
                            meal.meal_type === 'lunch' ? 'bg-green-400' :
                            'bg-blue-400'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Detail */}
        {mobileSelectedDate && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className={`px-4 py-3 border-b border-border ${isToday(mobileSelectedDate) ? 'bg-gold/10' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-lg font-serif ${isToday(mobileSelectedDate) ? 'text-gold-dark' : 'text-charcoal'}`}>
                    {mobileSelectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                  </span>
                  <span className="text-sm text-warm-gray ml-2">
                    {mobileSelectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <button
                  onClick={() => onSelectMobileDate(null)}
                  className="text-warm-gray hover:text-charcoal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Meals for selected day */}
            <div className="divide-y divide-border">
              {MEAL_TYPES.map(({ key: mealType, label }) => {
                const meals = getMealsForSlot(mobileSelectedDate, mealType);
                return (
                  <div key={mealType} className="p-3">
                    <div className="text-xs text-warm-gray uppercase mb-2">{label}</div>
                    {loading ? (
                      <div className="animate-pulse bg-cream-dark rounded-lg h-12" />
                    ) : meals.length > 0 ? (
                      <div className="space-y-2">
                        {meals.map(meal => (
                          <div
                            key={meal.id}
                            className="relative flex items-center gap-3 p-2 rounded-lg bg-cream"
                            onClick={(e) => onToggleMealActions(meal.id, e)}
                          >
                            {meal.recipe.cover_image_url && (
                              <img
                                src={meal.recipe.cover_image_url}
                                alt=""
                                className="w-12 h-12 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-charcoal truncate">{meal.recipe.title}</p>
                              <p className="text-xs text-warm-gray">{meal.servings} servings</p>
                            </div>

                            {/* Mobile Action Menu */}
                            {selectedMealForActions === meal.id && (
                              <div className="absolute inset-0 bg-white/95 rounded-lg flex items-center justify-center gap-4 z-10">
                                <Link
                                  href={`/recipes/${meal.recipe.id}`}
                                  className="p-2 text-charcoal hover:text-gold"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </Link>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onMove(meal); }}
                                  className="p-2 text-charcoal hover:text-gold"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRepeat(meal, e); }}
                                  className="p-2 text-charcoal hover:text-gold"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => onDelete(meal.id, e)}
                                  className="p-2 text-red-500"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onClearMealActions(); }}
                                  className="p-2 text-warm-gray"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => onSlotClick(mobileSelectedDate, mealType)}
                        className="w-full py-3 border-2 border-dashed border-border rounded-lg text-warm-gray hover:border-gold hover:text-gold text-sm transition-colors"
                      >
                        + Add {label.toLowerCase()}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Prompt to select a date */}
        {!mobileSelectedDate && (
          <div className="text-center py-6 text-warm-gray text-sm">
            Tap a date to see meals
          </div>
        )}
      </div>
    </>
  );
}
