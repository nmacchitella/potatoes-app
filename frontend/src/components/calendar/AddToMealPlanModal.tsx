'use client';

import { useState, useEffect, useMemo } from 'react';
import { mealPlanApi, authApi, getErrorMessage } from '@/lib/api';
import { formatDateForApi, getStartOfWeek, DAYS, MEAL_TYPES as BASE_MEAL_TYPES } from '@/lib/calendar-utils';
import { Modal } from '@/components/ui';
import type { MealType, MealPlan, UserSettings, MealPlanCalendar } from '@/types';

interface AddToMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  onSuccess?: () => void;
}

/** Extended meal types including snack for the add-to-plan modal */
const MEAL_TYPES: { key: MealType; label: string }[] = [
  ...BASE_MEAL_TYPES,
  { key: 'snack', label: 'Snack' },
];

export function AddToMealPlanModal({
  isOpen,
  onClose,
  recipeId,
  recipeTitle,
  onSuccess,
}: AddToMealPlanModalProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [servings, setServings] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [existingMeals, setExistingMeals] = useState<MealPlan[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);

  // Calendar state
  const [calendars, setCalendars] = useState<MealPlanCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  // Load calendars and user settings when modal opens
  useEffect(() => {
    if (isOpen) {
      // Load calendars
      setLoadingCalendars(true);
      mealPlanApi.listCalendars()
        .then(data => {
          setCalendars(data);
          // Select first owned calendar by default
          const ownedCalendar = data.find(c => c.is_owner);
          setSelectedCalendarId(ownedCalendar?.id || data[0]?.id || null);
        })
        .catch(err => console.error('Failed to fetch calendars:', err))
        .finally(() => setLoadingCalendars(false));

      // Load user settings
      authApi.getSettings()
        .then(settings => {
          setUserSettings(settings);
          setServings(settings.default_servings);
        })
        .catch(err => console.error('Failed to fetch user settings:', err));
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(null);
      setSelectedMealType(null);
      setWeekOffset(0);
      setError(null);
    }
  }, [isOpen]);

  // Calculate week dates based on offset
  const weekDates = useMemo(() => {
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
    startOfWeek.setDate(startOfWeek.getDate() + (weekOffset * 7));

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [weekOffset]);

  // Fetch existing meals when week changes
  useEffect(() => {
    if (!isOpen || weekDates.length === 0) return;

    const fetchMeals = async () => {
      setLoadingMeals(true);
      try {
        const start = formatDateForApi(weekDates[0]);
        const end = formatDateForApi(weekDates[6]);
        const response = await mealPlanApi.list(start, end);
        setExistingMeals(response.items || []);
      } catch (err) {
        console.error('Failed to fetch meal plans:', err);
        setExistingMeals([]);
      } finally {
        setLoadingMeals(false);
      }
    };

    fetchMeals();
  }, [isOpen, weekDates]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const getMealsForSlot = (date: Date, mealType: MealType): MealPlan[] => {
    const dateStr = formatDateForApi(date);
    return existingMeals.filter(
      meal => meal.planned_date === dateStr && meal.meal_type === mealType
    );
  };

  const handleSlotClick = (date: Date, mealType: MealType) => {
    const dateStr = formatDateForApi(date);
    setSelectedDate(dateStr);
    setSelectedMealType(mealType);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedMealType || !selectedCalendarId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await mealPlanApi.create({
        calendar_id: selectedCalendarId,
        recipe_id: recipeId,
        planned_date: selectedDate,
        meal_type: selectedMealType,
        servings: servings,
      });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to add to meal plan:', err);
      setError(getErrorMessage(err, 'Failed to add to meal plan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isToday = (date: Date) => {
    return date.getTime() === today.getTime();
  };

  const isPast = (date: Date) => {
    return date.getTime() < today.getTime();
  };

  const isSelected = (date: Date, mealType: MealType) => {
    return selectedDate === formatDateForApi(date) && selectedMealType === mealType;
  };

  const getWeekRangeLabel = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" className="!max-w-4xl" ariaLabel="Add to Meal Plan">
      <div className="bg-white rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-serif text-lg text-charcoal">Add to Meal Plan</h2>
            <p className="text-sm text-warm-gray truncate max-w-md">{recipeTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-warm-gray hover:text-charcoal transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-cream/50 border-b border-border shrink-0">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors text-charcoal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="font-medium text-charcoal">{getWeekRangeLabel()}</span>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs text-gold hover:text-gold-dark transition-colors"
              >
                Today
              </button>
            )}
          </div>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors text-charcoal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid - Mirrors WeekView styling */}
        <div className="overflow-auto flex-1 p-4">
          <div className="bg-white rounded-xl border border-border overflow-hidden min-w-[700px]">
            {/* Day Headers */}
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border">
              <div className="p-2 border-r border-border" />
              {weekDates.map((date, index) => {
                const dayIsToday = isToday(date);
                const dayIsPast = isPast(date);
                return (
                  <div
                    key={index}
                    className={`px-2 py-2 text-center border-r border-border last:border-r-0 ${
                      dayIsToday ? 'bg-gold/10' : dayIsPast ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className={`text-xs uppercase tracking-wide ${dayIsPast ? 'text-gray-400' : 'text-warm-gray'}`}>
                      {DAYS[index]}
                    </div>
                    <div className={`text-lg font-serif mt-0.5 ${
                      dayIsToday ? 'text-gold-dark font-semibold' : dayIsPast ? 'text-gray-400' : 'text-charcoal'
                    }`}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Meal Rows */}
            {MEAL_TYPES.map(({ key: mealType, label }) => (
              <div key={mealType} className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border last:border-b-0">
                <div className="p-2 border-r border-border flex items-start">
                  <span className="text-xs text-warm-gray uppercase tracking-wide font-medium">
                    {label}
                  </span>
                </div>
                {weekDates.map((date, dayIndex) => {
                  const meals = getMealsForSlot(date, mealType);
                  const dayIsPast = isPast(date);
                  const dayIsToday = isToday(date);
                  const slotSelected = isSelected(date, mealType);

                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[80px] p-1.5 border-r border-border last:border-r-0 transition-colors ${
                        dayIsToday ? 'bg-gold/5' : dayIsPast ? 'bg-gray-50' : ''
                      }`}
                    >
                      {loadingMeals ? (
                        <div className="animate-pulse bg-cream-dark rounded-lg h-12" />
                      ) : (
                        <div className="space-y-1.5 h-full flex flex-col">
                          {/* Existing meals */}
                          {meals.map(meal => {
                            const isCustom = !meal.recipe;
                            const title = isCustom ? meal.custom_title : meal.recipe?.title;
                            return (
                              <div
                                key={meal.id}
                                className={`rounded-lg p-1.5 text-xs ${
                                  isCustom ? 'bg-sage/10 border border-sage/20' : 'bg-cream'
                                }`}
                              >
                                {meal.recipe?.cover_image_url && (
                                  <div className="aspect-video rounded overflow-hidden mb-1">
                                    <img
                                      src={meal.recipe.cover_image_url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="font-medium text-charcoal line-clamp-2 text-[10px]">
                                  {title}
                                </div>
                                <div className="text-[9px] text-warm-gray mt-0.5">
                                  {meal.servings} servings
                                </div>
                              </div>
                            );
                          })}

                          {/* Add slot button */}
                          <button
                            type="button"
                            disabled={dayIsPast}
                            onClick={() => handleSlotClick(date, mealType)}
                            className={`flex-1 min-h-[40px] border-2 border-dashed rounded-lg flex items-center justify-center transition-all ${
                              slotSelected
                                ? 'border-gold bg-gold/20 ring-2 ring-gold/30'
                                : dayIsPast
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-border text-warm-gray hover:border-gold hover:text-gold hover:bg-gold/5'
                            }`}
                          >
                            {slotSelected ? (
                              <div className="text-center">
                                <svg className="w-4 h-4 mx-auto text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-[9px] text-gold font-medium">Selected</span>
                              </div>
                            ) : (
                              <svg className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-cream/30 p-4 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Calendar selector + Servings control */}
            <div className="flex items-center gap-4">
              {/* Calendar selector */}
              {calendars.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-charcoal">Calendar:</label>
                  <select
                    value={selectedCalendarId || ''}
                    onChange={(e) => setSelectedCalendarId(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-border rounded-lg bg-white"
                    disabled={loadingCalendars}
                  >
                    {calendars.map(cal => (
                      <option key={cal.id} value={cal.id}>
                        {cal.name}
                        {!cal.is_owner && cal.owner ? ` (${cal.owner.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Servings control */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-charcoal">Servings:</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setServings(s => Math.max(1, s - 1))}
                    className="w-7 h-7 rounded-lg bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal transition-colors text-sm"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-charcoal font-medium">{servings}</span>
                  <button
                    type="button"
                    onClick={() => setServings(s => s + 1)}
                    className="w-7 h-7 rounded-lg bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal transition-colors text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Selected slot display */}
            {selectedDate && selectedMealType && (
              <div className="text-sm text-warm-gray">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })} - {MEAL_TYPES.find(m => m.key === selectedMealType)?.label}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-warm-gray hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedDate || !selectedMealType || !selectedCalendarId}
                className="px-5 py-2 bg-gold hover:bg-gold-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add to Plan'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm mt-3">{error}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
