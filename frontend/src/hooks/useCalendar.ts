import { useState, useEffect, useMemo, useCallback } from 'react';
import { mealPlanApi, authApi } from '@/lib/api';
import {
  CalendarViewMode,
  DAYS,
  getStartOfWeek,
  getStartOfMonth,
  formatDateForApi,
  getDaysInMonth,
  isSameDay,
  isToday as checkIsToday,
  isCurrentMonth,
} from '@/lib/calendar-utils';
import type { MealPlan, MealType, UserSettings, SearchRecipeResult } from '@/types';

interface ClipboardState {
  meal: MealPlan;
  action: 'copy' | 'cut';
}

interface CalendarSlot {
  date: Date;
  mealType: MealType;
}

interface DragOverSlot {
  date: string;
  mealType: MealType;
}

interface UseCalendarReturn {
  // View state
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
  currentDate: Date;

  // Navigation
  goToPrevious: () => void;
  goToNext: () => void;
  goToToday: () => void;

  // Computed dates
  weekDates: Date[];
  monthDates: Date[];
  today: Date;

  // Mobile 3-day view
  mobile3DayDates: Date[];
  mobile3DayOffset: number;
  goMobile3DayPrev: () => void;
  goMobile3DayNext: () => void;
  goMobile3DayToday: () => void;
  mobileSelectedDate: Date | null;
  setMobileSelectedDate: (date: Date | null) => void;

  // Meal plans
  mealPlans: MealPlan[];
  loading: boolean;
  getMealsForSlot: (date: Date, mealType: MealType) => MealPlan[];
  getMealsForDate: (date: Date) => MealPlan[];

  // User settings
  userSettings: UserSettings | null;

  // Date helpers
  isPast: (date: Date) => boolean;
  isToday: (date: Date) => boolean;
  isSameMonth: (date: Date) => boolean;
  isCurrentPeriod: boolean;

  // Slot selection (for adding meals)
  selectedSlot: CalendarSlot | null;
  isAddModalOpen: boolean;
  handleSlotClick: (date: Date, mealType: MealType) => void;
  handleSelectRecipe: (recipe: SearchRecipeResult) => Promise<void>;
  closeAddModal: () => void;

  // Clipboard operations
  clipboard: ClipboardState | null;
  handleCopy: (meal: MealPlan, e: React.MouseEvent) => void;
  handleCut: (meal: MealPlan, e: React.MouseEvent) => void;
  clearClipboard: () => void;

  // Meal actions
  handleDeleteMeal: (mealId: string, e: React.MouseEvent) => Promise<void>;

  // Drag and drop
  draggedMeal: MealPlan | null;
  dragOverSlot: DragOverSlot | null;
  handleDragStart: (meal: MealPlan, e: React.DragEvent) => void;
  handleDragEnd: () => void;
  handleDragOver: (date: Date, mealType: MealType, e: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (date: Date, mealType: MealType, e: React.DragEvent) => Promise<void>;

  // Move meal (mobile)
  showMoveModal: boolean;
  mealToMove: MealPlan | null;
  moveDestination: CalendarSlot | null;
  setMoveDestination: (dest: CalendarSlot | null) => void;
  handleOpenMoveModal: (meal: MealPlan) => void;
  handleMoveMeal: () => Promise<void>;
  closeMoveModal: () => void;

  // Mobile action menu
  selectedMealForActions: string | null;
  toggleMealActions: (mealId: string, e: React.MouseEvent) => void;
  closeMealActions: () => void;

  // Copy weeks
  showCopyWeeksModal: boolean;
  copyWeeksCount: number;
  setCopyWeeksCount: (count: number) => void;
  openCopyWeeksModal: () => void;
  closeCopyWeeksModal: () => void;
  handleCopyWeeks: () => Promise<void>;
  copyingWeeks: boolean;

  // Recurring meals
  showRepeatModal: boolean;
  repeatMeal: MealPlan | null;
  repeatWeeksCount: number;
  setRepeatWeeksCount: (count: number) => void;
  handleOpenRepeatModal: (meal: MealPlan, e: React.MouseEvent) => void;
  handleCreateRecurring: () => Promise<void>;
  closeRepeatModal: () => void;
  creatingRecurring: boolean;

  // Refresh
  refresh: () => Promise<void>;
}

export function useCalendar(isActive: boolean = true): UseCalendarReturn {
  // Core state
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Clipboard
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  // Drag & drop
  const [draggedMeal, setDraggedMeal] = useState<MealPlan | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<DragOverSlot | null>(null);

  // Add meal modal
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Copy weeks modal
  const [showCopyWeeksModal, setShowCopyWeeksModal] = useState(false);
  const [copyWeeksCount, setCopyWeeksCount] = useState(1);
  const [copyingWeeks, setCopyingWeeks] = useState(false);

  // Repeat modal
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [repeatMeal, setRepeatMeal] = useState<MealPlan | null>(null);
  const [repeatWeeksCount, setRepeatWeeksCount] = useState(4);
  const [creatingRecurring, setCreatingRecurring] = useState(false);

  // Mobile state
  const [mobile3DayOffset, setMobile3DayOffset] = useState(0);
  const [mobileSelectedDate, setMobileSelectedDate] = useState<Date | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [mealToMove, setMealToMove] = useState<MealPlan | null>(null);
  const [moveDestination, setMoveDestination] = useState<CalendarSlot | null>(null);
  const [selectedMealForActions, setSelectedMealForActions] = useState<string | null>(null);

  // Computed dates
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const { calendarStartDate, calendarEndDate } = useMemo(() => {
    if (viewMode === 'day') {
      return { calendarStartDate: currentDate, calendarEndDate: currentDate };
    } else if (viewMode === 'week') {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { calendarStartDate: start, calendarEndDate: end };
    } else {
      const start = getStartOfMonth(currentDate);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { calendarStartDate: start, calendarEndDate: end };
    }
  }, [currentDate, viewMode]);

  const weekDates = useMemo(() => {
    const start = getStartOfWeek(currentDate);
    return DAYS.map((_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [currentDate]);

  const monthDates = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const mobile3DayDates = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return [0, 1, 2].map(i => {
      const date = new Date(todayDate);
      date.setDate(date.getDate() + mobile3DayOffset + i);
      return date;
    });
  }, [mobile3DayOffset]);

  const isCurrentPeriod = useMemo(() => {
    if (viewMode === 'day') return checkIsToday(currentDate);
    if (viewMode === 'week') {
      return getStartOfWeek(new Date()).getTime() === getStartOfWeek(currentDate).getTime();
    }
    return isCurrentMonth(new Date(), currentDate);
  }, [currentDate, viewMode]);

  // Fetch user settings on mount
  useEffect(() => {
    authApi.getSettings()
      .then(setUserSettings)
      .catch(err => console.error('Failed to fetch user settings:', err));
  }, []);

  // Fetch meal plans when active and date range changes
  const fetchMealPlans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mealPlanApi.list(
        formatDateForApi(calendarStartDate),
        formatDateForApi(calendarEndDate)
      );
      setMealPlans(response.items);
    } catch (err) {
      console.error('Failed to fetch meal plans:', err);
    } finally {
      setLoading(false);
    }
  }, [calendarStartDate, calendarEndDate]);

  useEffect(() => {
    if (isActive) {
      fetchMealPlans();
    }
  }, [isActive, fetchMealPlans]);

  // Navigation
  const goToPrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const goToNext = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  // Mobile 3-day navigation
  const goMobile3DayPrev = useCallback(() => setMobile3DayOffset(prev => prev - 3), []);
  const goMobile3DayNext = useCallback(() => setMobile3DayOffset(prev => prev + 3), []);
  const goMobile3DayToday = useCallback(() => setMobile3DayOffset(0), []);

  // Get meals for slot/date
  const getMealsForSlot = useCallback((date: Date, mealType: MealType): MealPlan[] => {
    const dateStr = formatDateForApi(date);
    return mealPlans.filter(mp => mp.planned_date === dateStr && mp.meal_type === mealType);
  }, [mealPlans]);

  const getMealsForDate = useCallback((date: Date): MealPlan[] => {
    const dateStr = formatDateForApi(date);
    return mealPlans.filter(mp => mp.planned_date === dateStr);
  }, [mealPlans]);

  // Date helpers
  const isPast = useCallback((date: Date) => date.getTime() < today.getTime(), [today]);
  const isToday = useCallback((date: Date) => isSameDay(date, today), [today]);
  const isSameMonthFn = useCallback((date: Date) => isCurrentMonth(date, currentDate), [currentDate]);

  // Slot click handler
  const handleSlotClick = useCallback((date: Date, mealType: MealType) => {
    if (clipboard) {
      // Paste if clipboard has content
      handlePaste(date, mealType);
      return;
    }
    setSelectedSlot({ date, mealType });
    setIsAddModalOpen(true);
  }, [clipboard]);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setSelectedSlot(null);
  }, []);

  // Select recipe handler
  const handleSelectRecipe = useCallback(async (recipe: SearchRecipeResult) => {
    if (!selectedSlot) return;
    try {
      const newMeal = await mealPlanApi.create({
        recipe_id: recipe.id,
        planned_date: formatDateForApi(selectedSlot.date),
        meal_type: selectedSlot.mealType,
        servings: userSettings?.default_servings ?? 4,
      });
      setMealPlans(prev => [...prev, newMeal]);
      closeAddModal();
    } catch (err) {
      console.error('Failed to add meal:', err);
      throw err;
    }
  }, [selectedSlot, userSettings, closeAddModal]);

  // Delete meal
  const handleDeleteMeal = useCallback(async (mealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Remove this meal from the plan?')) return;
    try {
      await mealPlanApi.delete(mealId);
      setMealPlans(prev => prev.filter(mp => mp.id !== mealId));
      if (clipboard?.meal.id === mealId) setClipboard(null);
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  }, [clipboard]);

  // Clipboard operations
  const handleCopy = useCallback((meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setClipboard({ meal, action: 'copy' });
  }, []);

  const handleCut = useCallback((meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setClipboard({ meal, action: 'cut' });
  }, []);

  const clearClipboard = useCallback(() => setClipboard(null), []);

  const handlePaste = useCallback(async (date: Date, mealType: MealType) => {
    if (!clipboard) return;
    try {
      if (clipboard.action === 'copy') {
        const newMeal = await mealPlanApi.create({
          recipe_id: clipboard.meal.recipe.id,
          planned_date: formatDateForApi(date),
          meal_type: mealType,
          servings: clipboard.meal.servings,
        });
        setMealPlans(prev => [...prev, newMeal]);
      } else {
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
  }, [clipboard]);

  // Drag and drop
  const handleDragStart = useCallback((meal: MealPlan, e: React.DragEvent) => {
    setDraggedMeal(meal);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', meal.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedMeal(null);
    setDragOverSlot(null);
  }, []);

  const handleDragOver = useCallback((date: Date, mealType: MealType, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot({ date: formatDateForApi(date), mealType });
  }, []);

  const handleDragLeave = useCallback(() => setDragOverSlot(null), []);

  const handleDrop = useCallback(async (date: Date, mealType: MealType, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (!draggedMeal) return;
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
  }, [draggedMeal]);

  // Move modal (mobile)
  const handleOpenMoveModal = useCallback((meal: MealPlan) => {
    setMealToMove(meal);
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setMoveDestination({ date: tomorrow, mealType: meal.meal_type });
    setShowMoveModal(true);
    setSelectedMealForActions(null);
  }, []);

  const handleMoveMeal = useCallback(async () => {
    if (!mealToMove || !moveDestination) return;
    try {
      const movedMeal = await mealPlanApi.move(mealToMove.id, {
        planned_date: formatDateForApi(moveDestination.date),
        meal_type: moveDestination.mealType,
      });
      setMealPlans(prev => prev.map(mp => mp.id === mealToMove.id ? movedMeal : mp));
      setShowMoveModal(false);
      setMealToMove(null);
      setMoveDestination(null);
    } catch (err) {
      console.error('Failed to move meal:', err);
    }
  }, [mealToMove, moveDestination]);

  const closeMoveModal = useCallback(() => {
    setShowMoveModal(false);
    setMealToMove(null);
    setMoveDestination(null);
  }, []);

  // Mobile action menu
  const toggleMealActions = useCallback((mealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedMealForActions(prev => prev === mealId ? null : mealId);
  }, []);

  const closeMealActions = useCallback(() => setSelectedMealForActions(null), []);

  // Copy weeks
  const openCopyWeeksModal = useCallback(() => setShowCopyWeeksModal(true), []);
  const closeCopyWeeksModal = useCallback(() => {
    setShowCopyWeeksModal(false);
    setCopyWeeksCount(1);
  }, []);

  const handleCopyWeeks = useCallback(async () => {
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
      closeCopyWeeksModal();
      fetchMealPlans();
    } catch (err) {
      console.error('Failed to copy weeks:', err);
    } finally {
      setCopyingWeeks(false);
    }
  }, [currentDate, copyWeeksCount, closeCopyWeeksModal, fetchMealPlans]);

  // Recurring meals
  const handleOpenRepeatModal = useCallback((meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRepeatMeal(meal);
    setRepeatWeeksCount(4);
    setShowRepeatModal(true);
    setSelectedMealForActions(null);
  }, []);

  const closeRepeatModal = useCallback(() => {
    setShowRepeatModal(false);
    setRepeatMeal(null);
  }, []);

  const handleCreateRecurring = useCallback(async () => {
    if (!repeatMeal) return;
    setCreatingRecurring(true);
    try {
      const mealDate = repeatMeal.planned_date;
      const startDate = new Date(mealDate + 'T00:00:00');
      const newMeals: MealPlan[] = [];
      for (let i = 1; i <= repeatWeeksCount; i++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + (7 * i));
        const newMeal = await mealPlanApi.create({
          recipe_id: repeatMeal.recipe.id,
          planned_date: formatDateForApi(targetDate),
          meal_type: repeatMeal.meal_type,
          servings: repeatMeal.servings,
        });
        newMeals.push(newMeal);
      }
      setMealPlans(prev => [...prev, ...newMeals]);
      closeRepeatModal();
    } catch (err) {
      console.error('Failed to create recurring meals:', err);
    } finally {
      setCreatingRecurring(false);
    }
  }, [repeatMeal, repeatWeeksCount, closeRepeatModal]);

  return {
    viewMode,
    setViewMode,
    currentDate,
    goToPrevious,
    goToNext,
    goToToday,
    weekDates,
    monthDates,
    today,
    mobile3DayDates,
    mobile3DayOffset,
    goMobile3DayPrev,
    goMobile3DayNext,
    goMobile3DayToday,
    mobileSelectedDate,
    setMobileSelectedDate,
    mealPlans,
    loading,
    getMealsForSlot,
    getMealsForDate,
    userSettings,
    isPast,
    isToday,
    isSameMonth: isSameMonthFn,
    isCurrentPeriod,
    selectedSlot,
    isAddModalOpen,
    handleSlotClick,
    handleSelectRecipe,
    closeAddModal,
    clipboard,
    handleCopy,
    handleCut,
    clearClipboard,
    handleDeleteMeal,
    draggedMeal,
    dragOverSlot,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    showMoveModal,
    mealToMove,
    moveDestination,
    setMoveDestination,
    handleOpenMoveModal,
    handleMoveMeal,
    closeMoveModal,
    selectedMealForActions,
    toggleMealActions,
    closeMealActions,
    showCopyWeeksModal,
    copyWeeksCount,
    setCopyWeeksCount,
    openCopyWeeksModal,
    closeCopyWeeksModal,
    handleCopyWeeks,
    copyingWeeks,
    showRepeatModal,
    repeatMeal,
    repeatWeeksCount,
    setRepeatWeeksCount,
    handleOpenRepeatModal,
    handleCreateRecurring,
    closeRepeatModal,
    creatingRecurring,
    refresh: fetchMealPlans,
  };
}
