'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import RecipeSearchModal from '@/components/search/RecipeSearchModal';
import { mealPlanApi, authApi } from '@/lib/api';
import type { MealPlan, MealType, SearchRecipeResult, UserSettings } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'day' | 'week' | 'month';

interface ClipboardState {
  meal: MealPlan;
  action: 'copy' | 'cut';
}

// ============================================================================
// HELPERS
// ============================================================================

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatWeekRange(startOfWeek: Date): string {
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
  const year = endOfWeek.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${year}`;
  }
  return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${year}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getDaysInMonth(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: Date[] = [];

  // Add days from previous month to start on Monday
  const startDayOfWeek = firstDay.getDay();
  const daysFromPrevMonth = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  for (let i = daysFromPrevMonth; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    days.push(d);
  }

  // Add all days in current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add days from next month to complete the grid (6 rows)
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function CalendarPage() {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data state
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; mealType: MealType } | null>(null);
  const [addingMeal, setAddingMeal] = useState(false);

  // Copy/paste state
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  // Drag state
  const [draggedMeal, setDraggedMeal] = useState<MealPlan | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; mealType: MealType } | null>(null);

  // Copy weeks modal
  const [showCopyWeeksModal, setShowCopyWeeksModal] = useState(false);
  const [copyWeeksCount, setCopyWeeksCount] = useState(1);
  const [copyingWeeks, setCopyingWeeks] = useState(false);

  // User settings
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Computed dates based on view mode
  const { startDate, endDate } = useMemo(() => {
    if (viewMode === 'day') {
      return { startDate: currentDate, endDate: currentDate };
    } else if (viewMode === 'week') {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { startDate: start, endDate: end };
    } else {
      const start = getStartOfMonth(currentDate);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { startDate: start, endDate: end };
    }
  }, [currentDate, viewMode]);

  // Today reference
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const isPast = (date: Date) => date.getTime() < today.getTime();
  const isToday = (date: Date) => date.getTime() === today.getTime();
  const isSameMonth = (date: Date, reference: Date) =>
    date.getMonth() === reference.getMonth() && date.getFullYear() === reference.getFullYear();

  // Fetch user settings on mount
  useEffect(() => {
    authApi.getSettings()
      .then(setUserSettings)
      .catch(err => console.error('Failed to fetch user settings:', err));
  }, []);

  // Fetch meal plans when date range changes
  useEffect(() => {
    fetchMealPlans();
  }, [startDate, endDate]);

  const fetchMealPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await mealPlanApi.list(
        formatDateForApi(startDate),
        formatDateForApi(endDate)
      );
      setMealPlans(response.items);
    } catch (err) {
      console.error('Failed to fetch meal plans:', err);
      setError('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToDate = (date: Date) => {
    setCurrentDate(date);
    setShowDatePicker(false);
  };

  // Get week dates for week view
  const weekDates = useMemo(() => {
    const start = getStartOfWeek(currentDate);
    return DAYS.map((_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [currentDate]);

  // Get month dates for month view
  const monthDates = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  // Get meals for a specific date and meal type
  const getMealsForSlot = useCallback((date: Date, mealType: MealType): MealPlan[] => {
    const dateStr = formatDateForApi(date);
    return mealPlans.filter(
      mp => mp.planned_date === dateStr && mp.meal_type === mealType
    );
  }, [mealPlans]);

  // Get all meals for a date (for month view)
  const getMealsForDate = useCallback((date: Date): MealPlan[] => {
    const dateStr = formatDateForApi(date);
    return mealPlans.filter(mp => mp.planned_date === dateStr);
  }, [mealPlans]);

  // Handle clicking on a slot to add a meal
  const handleSlotClick = (date: Date, mealType: MealType) => {
    // If there's something in clipboard, paste it
    if (clipboard) {
      handlePaste(date, mealType);
      return;
    }
    setSelectedSlot({ date, mealType });
    setIsAddModalOpen(true);
  };

  // Handle selecting a recipe from the modal
  const handleSelectRecipe = async (recipe: SearchRecipeResult) => {
    if (!selectedSlot) return;

    setAddingMeal(true);
    try {
      const newMeal = await mealPlanApi.create({
        recipe_id: recipe.id,
        planned_date: formatDateForApi(selectedSlot.date),
        meal_type: selectedSlot.mealType,
        servings: userSettings?.default_servings ?? 4,
      });
      setMealPlans(prev => [...prev, newMeal]);
      setIsAddModalOpen(false);
      setSelectedSlot(null);
    } catch (err) {
      console.error('Failed to add meal:', err);
      throw err;
    } finally {
      setAddingMeal(false);
    }
  };

  // Handle deleting a meal
  const handleDeleteMeal = async (mealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Remove this meal from the plan?')) return;

    try {
      await mealPlanApi.delete(mealId);
      setMealPlans(prev => prev.filter(mp => mp.id !== mealId));
      // Clear clipboard if deleted meal was in it
      if (clipboard?.meal.id === mealId) {
        setClipboard(null);
      }
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  };

  // Copy meal to clipboard
  const handleCopy = (meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setClipboard({ meal, action: 'copy' });
  };

  // Cut meal to clipboard
  const handleCut = (meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setClipboard({ meal, action: 'cut' });
  };

  // Paste from clipboard
  const handlePaste = async (date: Date, mealType: MealType) => {
    if (!clipboard) return;

    try {
      if (clipboard.action === 'copy') {
        // Create new meal
        const newMeal = await mealPlanApi.create({
          recipe_id: clipboard.meal.recipe.id,
          planned_date: formatDateForApi(date),
          meal_type: mealType,
          servings: clipboard.meal.servings,
        });
        setMealPlans(prev => [...prev, newMeal]);
      } else {
        // Move existing meal
        const movedMeal = await mealPlanApi.move(clipboard.meal.id, {
          planned_date: formatDateForApi(date),
          meal_type: mealType,
        });
        setMealPlans(prev => prev.map(mp => mp.id === clipboard.meal.id ? movedMeal : mp));
      }
      setClipboard(null);
    } catch (err) {
      console.error('Failed to paste meal:', err);
    }
  };

  // Cancel clipboard
  const handleCancelClipboard = () => {
    setClipboard(null);
  };

  // Drag and drop handlers
  const handleDragStart = (meal: MealPlan, e: React.DragEvent) => {
    setDraggedMeal(meal);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', meal.id);
  };

  const handleDragEnd = () => {
    setDraggedMeal(null);
    setDragOverSlot(null);
  };

  const handleDragOver = (date: Date, mealType: MealType, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot({ date: formatDateForApi(date), mealType });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (date: Date, mealType: MealType, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggedMeal) return;

    // Don't do anything if dropping in same slot
    if (draggedMeal.planned_date === formatDateForApi(date) && draggedMeal.meal_type === mealType) {
      setDraggedMeal(null);
      return;
    }

    try {
      const movedMeal = await mealPlanApi.move(draggedMeal.id, {
        planned_date: formatDateForApi(date),
        meal_type: mealType,
      });
      setMealPlans(prev => prev.map(mp => mp.id === draggedMeal.id ? movedMeal : mp));
    } catch (err) {
      console.error('Failed to move meal:', err);
    }

    setDraggedMeal(null);
  };

  // Copy week to next X weeks
  const handleCopyWeeks = async () => {
    setCopyingWeeks(true);
    try {
      const weekStart = getStartOfWeek(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      for (let i = 1; i <= copyWeeksCount; i++) {
        const targetStart = new Date(weekStart);
        targetStart.setDate(targetStart.getDate() + (7 * i));

        await mealPlanApi.copy({
          source_start: formatDateForApi(weekStart),
          source_end: formatDateForApi(weekEnd),
          target_start: formatDateForApi(targetStart),
        });
      }

      setShowCopyWeeksModal(false);
      setCopyWeeksCount(1);
      // Refresh to show new meals if viewing affected weeks
      fetchMealPlans();
    } catch (err) {
      console.error('Failed to copy weeks:', err);
    } finally {
      setCopyingWeeks(false);
    }
  };

  // Format header text based on view
  const headerText = useMemo(() => {
    if (viewMode === 'day') return formatDayDate(currentDate);
    if (viewMode === 'week') return formatWeekRange(getStartOfWeek(currentDate));
    return formatMonthYear(currentDate);
  }, [currentDate, viewMode]);

  const isCurrentPeriod = useMemo(() => {
    if (viewMode === 'day') return isToday(currentDate);
    if (viewMode === 'week') return getStartOfWeek(new Date()).getTime() === getStartOfWeek(currentDate).getTime();
    return isSameMonth(new Date(), currentDate);
  }, [currentDate, viewMode, today]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderMealCard = (meal: MealPlan, compact = false) => {
    const isBeingDragged = draggedMeal?.id === meal.id;
    const isInClipboard = clipboard?.meal.id === meal.id;

    return (
      <div
        key={meal.id}
        draggable
        onDragStart={(e) => handleDragStart(meal, e)}
        onDragEnd={handleDragEnd}
        className={`group relative rounded-lg p-2 transition-all cursor-grab active:cursor-grabbing ${
          isBeingDragged ? 'opacity-50 scale-95' : ''
        } ${isInClipboard ? 'ring-2 ring-gold ring-offset-1' : ''} ${
          compact ? 'bg-gold/20' : 'bg-cream hover:bg-cream-dark'
        }`}
      >
        {/* Recipe image */}
        {!compact && meal.recipe.cover_image_url && (
          <div className="aspect-video rounded overflow-hidden mb-1.5">
            <img
              src={meal.recipe.cover_image_url}
              alt={meal.recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Recipe title */}
        <Link
          href={`/recipes/${meal.recipe.id}`}
          className={`font-medium text-charcoal hover:text-gold block ${compact ? 'text-[10px] line-clamp-1' : 'text-xs line-clamp-2'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {meal.recipe.title}
        </Link>

        {/* Servings (not in compact) */}
        {!compact && (
          <div className="text-[10px] text-warm-gray mt-0.5">
            {meal.servings} servings
          </div>
        )}

        {/* Action buttons */}
        <div className={`absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${compact ? 'scale-75' : ''}`}>
          <button
            onClick={(e) => handleCopy(meal, e)}
            className="p-1 rounded bg-white/80 text-warm-gray hover:text-gold"
            title="Copy"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => handleCut(meal, e)}
            className="p-1 rounded bg-white/80 text-warm-gray hover:text-orange-500"
            title="Cut (move)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </button>
          <button
            onClick={(e) => handleDeleteMeal(meal.id, e)}
            className="p-1 rounded bg-white/80 text-warm-gray hover:text-red-500"
            title="Delete"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderDayCell = (date: Date, mealType: MealType, compact = false) => {
    const meals = getMealsForSlot(date, mealType);
    const dateStr = formatDateForApi(date);
    const isDragOver = dragOverSlot?.date === dateStr && dragOverSlot?.mealType === mealType;
    const past = isPast(date);

    return (
      <div
        className={`${compact ? 'min-h-[60px]' : 'min-h-[100px]'} p-2 border-r border-border last:border-r-0 transition-colors ${
          isToday(date) ? 'bg-gold/5' : past ? 'bg-gray-50' : ''
        } ${isDragOver ? 'bg-gold/20' : ''} ${clipboard ? 'cursor-pointer' : ''}`}
        onDragOver={(e) => handleDragOver(date, mealType, e)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(date, mealType, e)}
        onClick={() => clipboard && handlePaste(date, mealType)}
      >
        {loading ? (
          <div className={`animate-pulse bg-cream-dark rounded-lg ${compact ? 'h-8' : 'h-16'}`} />
        ) : meals.length > 0 ? (
          <div className={compact ? 'space-y-1' : 'space-y-2'}>
            {meals.map(meal => renderMealCard(meal, compact))}
            {!compact && (
              <button
                onClick={(e) => { e.stopPropagation(); handleSlotClick(date, mealType); }}
                className="w-full py-1 text-xs text-warm-gray hover:text-gold transition-colors"
              >
                + Add
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleSlotClick(date, mealType); }}
            className={`w-full h-full ${compact ? 'min-h-[40px]' : 'min-h-[80px]'} border-2 border-dashed rounded-lg flex items-center justify-center transition-colors group ${
              past ? 'border-gray-200 text-gray-300' : 'border-border text-warm-gray hover:border-gold hover:text-gold'
            } ${clipboard ? 'border-gold border-solid bg-gold/10' : ''}`}
          >
            <svg className={`w-4 h-4 ${clipboard ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER VIEWS
  // ============================================================================

  const renderWeekView = () => (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border">
        <div className="p-3 border-r border-border" />
        {weekDates.map((date, index) => (
          <div
            key={index}
            className={`px-3 py-3 text-center border-r border-border last:border-r-0 ${
              isToday(date) ? 'bg-gold/10' : isPast(date) ? 'bg-gray-50' : ''
            }`}
          >
            <div className={`text-xs uppercase tracking-wide ${isPast(date) ? 'text-gray-400' : 'text-warm-gray'}`}>
              {DAYS[index]}
            </div>
            <div className={`text-lg font-serif mt-1 ${
              isToday(date) ? 'text-gold-dark font-semibold' : isPast(date) ? 'text-gray-400' : 'text-charcoal'
            }`}>
              {date.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Meal Rows */}
      {MEAL_TYPES.map(({ key: mealType, label }) => (
        <div key={mealType} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border last:border-b-0">
          <div className="p-3 border-r border-border flex items-start">
            <span className="text-xs text-warm-gray uppercase tracking-wide font-medium">
              {label}
            </span>
          </div>
          {weekDates.map((date, dayIndex) => (
            <div key={dayIndex}>
              {renderDayCell(date, mealType)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const renderDayView = () => (
    <div className="bg-white rounded-xl border border-border overflow-hidden max-w-2xl mx-auto">
      <div className={`px-6 py-4 border-b border-border ${isToday(currentDate) ? 'bg-gold/10' : isPast(currentDate) ? 'bg-gray-50' : ''}`}>
        <div className={`text-2xl font-serif ${isToday(currentDate) ? 'text-gold-dark' : isPast(currentDate) ? 'text-gray-400' : 'text-charcoal'}`}>
          {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
        <div className={`text-sm ${isPast(currentDate) ? 'text-gray-400' : 'text-warm-gray'}`}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {MEAL_TYPES.map(({ key: mealType, label }) => (
        <div key={mealType} className="border-b border-border last:border-b-0">
          <div className="px-6 py-3 bg-cream-dark">
            <span className="text-sm font-medium text-charcoal">{label}</span>
          </div>
          <div className="p-4">
            {renderDayCell(currentDate, mealType)}
          </div>
        </div>
      ))}
    </div>
  );

  const renderMonthView = () => (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS.map(day => (
          <div key={day} className="px-2 py-2 text-center border-r border-border last:border-r-0">
            <div className="text-xs text-warm-gray uppercase tracking-wide">{day}</div>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
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
              onDragOver={(e) => handleDragOver(date, 'lunch', e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(date, 'lunch', e)}
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
                    draggable
                    onDragStart={(e) => handleDragStart(meal, e)}
                    onDragEnd={handleDragEnd}
                    className={`text-[10px] px-1 py-0.5 rounded truncate cursor-grab ${
                      meal.meal_type === 'breakfast' ? 'bg-orange-100 text-orange-800' :
                      meal.meal_type === 'lunch' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    } ${draggedMeal?.id === meal.id ? 'opacity-50' : ''}`}
                    title={meal.recipe.title}
                  >
                    {meal.recipe.title}
                  </div>
                ))}
                {meals.length > 3 && (
                  <div className="text-[10px] text-warm-gray">+{meals.length - 3} more</div>
                )}
              </div>

              {/* Click to add (subtle) */}
              {meals.length === 0 && inCurrentMonth && (
                <button
                  onClick={() => handleSlotClick(date, 'dinner')}
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
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-warm-gray hover:text-charcoal transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-serif text-2xl text-charcoal">Meal Plan</h1>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-cream-dark rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                  viewMode === mode ? 'bg-white text-charcoal shadow-sm' : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {!isCurrentPeriod && (
              <button onClick={goToToday} className="px-3 py-1.5 text-sm text-gold hover:text-gold-dark transition-colors">
                Today
              </button>
            )}

            {viewMode === 'week' && (
              <button
                onClick={() => setShowCopyWeeksModal(true)}
                className="px-3 py-1.5 text-sm text-warm-gray hover:text-charcoal transition-colors"
                title="Copy this week to future weeks"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}

            <button onClick={goToPrevious} className="p-2 text-warm-gray hover:text-charcoal hover:bg-cream-dark rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Date with picker */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="text-sm font-medium text-charcoal min-w-[180px] text-center hover:text-gold transition-colors"
              >
                {headerText}
              </button>

              {showDatePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-border p-4 z-50">
                    <input
                      type="date"
                      value={formatDateForApi(currentDate)}
                      onChange={(e) => goToDate(new Date(e.target.value + 'T00:00:00'))}
                      className="px-3 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                </>
              )}
            </div>

            <button onClick={goToNext} className="p-2 text-warm-gray hover:text-charcoal hover:bg-cream-dark rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Clipboard indicator */}
        {clipboard && (
          <div className="mb-4 p-3 bg-gold/10 border border-gold/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-charcoal">
                <strong>{clipboard.meal.recipe.title}</strong> {clipboard.action === 'copy' ? 'copied' : 'cut'} — click a slot to paste
              </span>
            </div>
            <button onClick={handleCancelClipboard} className="text-warm-gray hover:text-charcoal text-sm">
              Cancel
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button onClick={fetchMealPlans} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Calendar Views */}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}

        {/* Help text */}
        {!loading && mealPlans.length === 0 && (
          <div className="text-center py-8">
            <p className="text-warm-gray">Click on a slot to add a recipe to your meal plan.</p>
          </div>
        )}
      </div>

      {/* Add Recipe Modal */}
      <RecipeSearchModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setSelectedSlot(null); }}
        onSelectRecipe={handleSelectRecipe}
        title={selectedSlot ? `Add ${selectedSlot.mealType} for ${selectedSlot.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}` : 'Add Recipe'}
      />

      {/* Copy Weeks Modal */}
      {showCopyWeeksModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="font-serif text-xl text-charcoal mb-4">Copy Week</h2>
            <p className="text-sm text-warm-gray mb-4">
              Copy all meals from this week ({formatWeekRange(getStartOfWeek(currentDate))}) to the next:
            </p>

            <div className="flex items-center gap-3 mb-6">
              <input
                type="number"
                min={1}
                max={12}
                value={copyWeeksCount}
                onChange={(e) => setCopyWeeksCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                className="w-20 px-3 py-2 border border-border rounded-lg text-center"
              />
              <span className="text-sm text-charcoal">week{copyWeeksCount !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCopyWeeksModal(false)}
                className="flex-1 px-4 py-2 text-sm text-warm-gray hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyWeeks}
                disabled={copyingWeeks}
                className="flex-1 px-4 py-2 text-sm bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                {copyingWeeks ? 'Copying...' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
