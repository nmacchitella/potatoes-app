'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeApi, collectionApi, socialApi, mealPlanApi, authApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import RecipeSearchModal from '@/components/search/RecipeSearchModal';
import type { RecipeSummary, Collection, Tag, SharedCollection, CollectionShare, UserSearchResult, SearchRecipeResult, MealPlan, MealType, UserSettings, MealPlanShare } from '@/types';

type PageView = 'recipes' | 'calendar';
type CalendarViewMode = 'day' | 'week' | 'month';

// Calendar helper functions
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
  const startDayOfWeek = firstDay.getDay();
  const daysFromPrevMonth = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  for (let i = daysFromPrevMonth; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
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

interface ClipboardState {
  meal: MealPlan;
  action: 'copy' | 'cut';
}

function RecipesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Page view toggle
  const [pageView, setPageView] = useState<PageView>('recipes');

  // Recipe state
  const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [initialCollectionLoaded, setInitialCollectionLoaded] = useState(false);

  // Inline collection management
  const [isManageMode, setIsManageMode] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  // Recipe management panel
  const [managingCollectionId, setManagingCollectionId] = useState<string | null>(null);
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<Set<string>>(new Set());
  const [savingRecipes, setSavingRecipes] = useState<string | null>(null);

  // Local filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'all' | 'any'>('all'); // 'all' = AND, 'any' = OR

  // Shared collections state
  const [sharedCollections, setSharedCollections] = useState<SharedCollection[]>([]);

  // Sharing modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shares, setShares] = useState<CollectionShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sharingUser, setSharingUser] = useState<string | null>(null);

  // Add recipes modal state
  const [isAddRecipesModalOpen, setIsAddRecipesModalOpen] = useState(false);

  // Calendar state
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loadingMealPlans, setLoadingMealPlans] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [draggedMeal, setDraggedMeal] = useState<MealPlan | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; mealType: MealType } | null>(null);
  const [calendarSelectedSlot, setCalendarSelectedSlot] = useState<{ date: Date; mealType: MealType } | null>(null);
  const [isCalendarAddModalOpen, setIsCalendarAddModalOpen] = useState(false);
  const [showCopyWeeksModal, setShowCopyWeeksModal] = useState(false);
  const [copyWeeksCount, setCopyWeeksCount] = useState(1);
  const [copyingWeeks, setCopyingWeeks] = useState(false);

  // Calendar sharing state
  const [isCalendarShareModalOpen, setIsCalendarShareModalOpen] = useState(false);
  const [calendarShares, setCalendarShares] = useState<MealPlanShare[]>([]);
  const [loadingCalendarShares, setLoadingCalendarShares] = useState(false);
  const [calendarUserSearchQuery, setCalendarUserSearchQuery] = useState('');
  const [calendarUserSearchResults, setCalendarUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingCalendarUsers, setSearchingCalendarUsers] = useState(false);
  const [sharingCalendarUser, setSharingCalendarUser] = useState<string | null>(null);

  // Recurring meal state
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [repeatMeal, setRepeatMeal] = useState<MealPlan | null>(null);
  const [repeatWeeksCount, setRepeatWeeksCount] = useState(4);
  const [creatingRecurring, setCreatingRecurring] = useState(false);

  // Mobile calendar state
  const [mobile3DayOffset, setMobile3DayOffset] = useState(0); // Offset in days from today for mobile 3-day view
  const [mobileSelectedDate, setMobileSelectedDate] = useState<Date | null>(null); // Selected date for mobile month view
  const [showMoveModal, setShowMoveModal] = useState(false); // Move meal modal
  const [mealToMove, setMealToMove] = useState<MealPlan | null>(null);
  const [selectedMealForActions, setSelectedMealForActions] = useState<string | null>(null); // For mobile meal action menu
  const [moveDestination, setMoveDestination] = useState<{ date: Date; mealType: MealType } | null>(null); // Move modal destination

  const newCollectionInputRef = useRef<HTMLInputElement>(null);
  const editCollectionInputRef = useRef<HTMLInputElement>(null);

  // Track previous URL param to detect actual URL changes vs re-renders
  const prevUrlCollectionRef = useRef<string | null | undefined>(undefined);

  // Load collections on mount
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const [ownCollections, shared] = await Promise.all([
        collectionApi.list(),
        collectionApi.listSharedWithMe(),
      ]);
      setCollections(ownCollections);
      setSharedCollections(shared);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  // Read collection from URL query parameter
  useEffect(() => {
    if (!loadingCollections) {
      const collectionParam = searchParams.get('collection');

      if (!initialCollectionLoaded) {
        // Initial load: set collection if valid
        const isOwnCollection = collections.some(c => c.id === collectionParam);
        const isSharedCollection = sharedCollections.some(c => c.id === collectionParam);
        if (collectionParam && (isOwnCollection || isSharedCollection)) {
          setSelectedCollection(collectionParam);
        }
        prevUrlCollectionRef.current = collectionParam;
        setInitialCollectionLoaded(true);
      } else if (prevUrlCollectionRef.current !== collectionParam) {
        // URL actually changed externally (e.g., clicking logo to go back to /recipes)
        prevUrlCollectionRef.current = collectionParam;

        if (!collectionParam) {
          setSelectedCollection(null);
        } else {
          const isOwnCollection = collections.some(c => c.id === collectionParam);
          const isSharedCollection = sharedCollections.some(c => c.id === collectionParam);
          if (isOwnCollection || isSharedCollection) {
            setSelectedCollection(collectionParam);
          }
        }
      }
    }
  }, [searchParams, collections, sharedCollections, loadingCollections, initialCollectionLoaded]);

  // Update URL when collection changes from sidebar clicks (not from URL navigation)
  useEffect(() => {
    if (initialCollectionLoaded) {
      const currentParam = searchParams.get('collection');
      // Only update URL if state differs AND the change didn't come from URL navigation
      if (selectedCollection !== currentParam && prevUrlCollectionRef.current === currentParam) {
        prevUrlCollectionRef.current = selectedCollection;
        const url = selectedCollection
          ? `/recipes?collection=${selectedCollection}`
          : '/recipes';
        router.replace(url, { scroll: false });
      }
    }
  }, [selectedCollection, initialCollectionLoaded, router, searchParams]);

  // Load recipes when collection changes
  useEffect(() => {
    fetchRecipes();
  }, [currentPage, selectedCollection]);

  // Clear filters when changing collection
  useEffect(() => {
    setSearchQuery('');
    setSelectedTags([]);
  }, [selectedCollection]);

  // Focus input when creating new collection
  useEffect(() => {
    if (isCreatingCollection && newCollectionInputRef.current) {
      newCollectionInputRef.current.focus();
    }
  }, [isCreatingCollection]);

  // Focus input when editing collection
  useEffect(() => {
    if (editingCollectionId && editCollectionInputRef.current) {
      editCollectionInputRef.current.focus();
    }
  }, [editingCollectionId]);

  // Load collection recipes when managing
  useEffect(() => {
    if (managingCollectionId) {
      loadCollectionRecipes(managingCollectionId);
    }
  }, [managingCollectionId]);

  const loadCollectionRecipes = async (collectionId: string) => {
    try {
      const collection = await collectionApi.get(collectionId);
      setCollectionRecipeIds(new Set(collection.recipes.map(r => r.id)));
    } catch (error) {
      console.error('Failed to load collection recipes:', error);
    }
  };

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      if (selectedCollection) {
        const collection = await collectionApi.get(selectedCollection);
        setAllRecipes(collection.recipes);
        setTotalPages(1);
      } else {
        const response = await recipeApi.list({
          page: currentPage,
          page_size: 100,
        });
        setAllRecipes(response.items);
        setTotalPages(response.total_pages);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique tags from current recipes
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    allRecipes.forEach(recipe => {
      recipe.tags?.forEach(tag => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag);
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRecipes]);

  // Filter recipes locally
  const filteredRecipes = useMemo(() => {
    let result = allRecipes;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(recipe =>
        recipe.title.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query)
      );
    }

    if (selectedTags.length > 0) {
      if (tagFilterMode === 'all') {
        // AND: recipe must have ALL selected tags
        result = result.filter(recipe =>
          selectedTags.every(tagId =>
            recipe.tags?.some(tag => tag.id === tagId)
          )
        );
      } else {
        // OR: recipe must have ANY of the selected tags
        result = result.filter(recipe =>
          selectedTags.some(tagId =>
            recipe.tags?.some(tag => tag.id === tagId)
          )
        );
      }
    }

    return result;
  }, [allRecipes, searchQuery, selectedTags, tagFilterMode]);

  // ============================================================================
  // CALENDAR LOGIC
  // ============================================================================

  // Computed dates based on view mode
  const { calendarStartDate, calendarEndDate } = useMemo(() => {
    if (calendarViewMode === 'day') {
      return { calendarStartDate: currentDate, calendarEndDate: currentDate };
    } else if (calendarViewMode === 'week') {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { calendarStartDate: start, calendarEndDate: end };
    } else {
      const start = getStartOfMonth(currentDate);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { calendarStartDate: start, calendarEndDate: end };
    }
  }, [currentDate, calendarViewMode]);

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

  // Fetch meal plans when calendar view is active and date range changes
  useEffect(() => {
    if (pageView === 'calendar') {
      fetchMealPlans();
    }
  }, [pageView, calendarStartDate, calendarEndDate]);

  const fetchMealPlans = async () => {
    setLoadingMealPlans(true);
    try {
      const response = await mealPlanApi.list(
        formatDateForApi(calendarStartDate),
        formatDateForApi(calendarEndDate)
      );
      setMealPlans(response.items);
    } catch (err) {
      console.error('Failed to fetch meal plans:', err);
    } finally {
      setLoadingMealPlans(false);
    }
  };

  // Calendar navigation
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (calendarViewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (calendarViewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (calendarViewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (calendarViewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

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

  // Get mobile 3-day dates (today + offset, showing 3 days)
  const mobile3DayDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [0, 1, 2].map(i => {
      const date = new Date(today);
      date.setDate(date.getDate() + mobile3DayOffset + i);
      return date;
    });
  }, [mobile3DayOffset]);

  // Mobile navigation for 3-day view
  const goMobile3DayPrev = () => setMobile3DayOffset(prev => prev - 3);
  const goMobile3DayNext = () => setMobile3DayOffset(prev => prev + 3);
  const goMobile3DayToday = () => setMobile3DayOffset(0);

  // Get meals for a specific date and meal type
  const getMealsForSlot = (date: Date, mealType: MealType): MealPlan[] => {
    const dateStr = formatDateForApi(date);
    return mealPlans.filter(mp => mp.planned_date === dateStr && mp.meal_type === mealType);
  };

  // Get all meals for a date (for month view)
  const getMealsForDate = (date: Date): MealPlan[] => {
    const dateStr = formatDateForApi(date);
    return mealPlans.filter(mp => mp.planned_date === dateStr);
  };

  // Handle clicking on a slot to add a meal
  const handleCalendarSlotClick = (date: Date, mealType: MealType) => {
    if (clipboard) {
      handlePaste(date, mealType);
      return;
    }
    setCalendarSelectedSlot({ date, mealType });
    setIsCalendarAddModalOpen(true);
  };

  // Handle selecting a recipe for calendar
  const handleCalendarSelectRecipe = async (recipe: SearchRecipeResult) => {
    if (!calendarSelectedSlot) return;
    try {
      const newMeal = await mealPlanApi.create({
        recipe_id: recipe.id,
        planned_date: formatDateForApi(calendarSelectedSlot.date),
        meal_type: calendarSelectedSlot.mealType,
        servings: userSettings?.default_servings ?? 4,
      });
      setMealPlans(prev => [...prev, newMeal]);
      setIsCalendarAddModalOpen(false);
      setCalendarSelectedSlot(null);
    } catch (err) {
      console.error('Failed to add meal:', err);
      throw err;
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
      if (clipboard?.meal.id === mealId) setClipboard(null);
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  };

  // Copy/cut/paste handlers
  const handleCopy = (meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setClipboard({ meal, action: 'copy' });
  };

  const handleCut = (meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setClipboard({ meal, action: 'cut' });
  };

  const handlePaste = async (date: Date, mealType: MealType) => {
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
  };

  // Mobile move meal handlers
  const handleOpenMoveModal = (meal: MealPlan) => {
    setMealToMove(meal);
    // Initialize destination with tomorrow, same meal type
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setMoveDestination({ date: tomorrow, mealType: meal.meal_type });
    setShowMoveModal(true);
    setSelectedMealForActions(null);
  };

  const handleMoveMeal = async (date: Date, mealType: MealType) => {
    if (!mealToMove) return;
    try {
      const movedMeal = await mealPlanApi.move(mealToMove.id, {
        planned_date: formatDateForApi(date),
        meal_type: mealType,
      });
      setMealPlans(prev => prev.map(mp => mp.id === mealToMove.id ? movedMeal : mp));
      setShowMoveModal(false);
      setMealToMove(null);
      setMoveDestination(null);
    } catch (err) {
      console.error('Failed to move meal:', err);
    }
  };

  // Toggle mobile meal action menu
  const toggleMealActions = (mealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedMealForActions(prev => prev === mealId ? null : mealId);
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

  const handleDragLeave = () => setDragOverSlot(null);

  const handleDrop = async (date: Date, mealType: MealType, e: React.DragEvent) => {
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
  };

  // Copy week handler
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
      fetchMealPlans();
    } catch (err) {
      console.error('Failed to copy weeks:', err);
    } finally {
      setCopyingWeeks(false);
    }
  };

  // Calendar header text
  const calendarHeaderText = useMemo(() => {
    if (calendarViewMode === 'day') return formatDayDate(currentDate);
    if (calendarViewMode === 'week') return formatWeekRange(getStartOfWeek(currentDate));
    return formatMonthYear(currentDate);
  }, [currentDate, calendarViewMode]);

  const isCurrentPeriod = useMemo(() => {
    if (calendarViewMode === 'day') return isToday(currentDate);
    if (calendarViewMode === 'week') return getStartOfWeek(new Date()).getTime() === getStartOfWeek(currentDate).getTime();
    return isSameMonth(new Date(), currentDate);
  }, [currentDate, calendarViewMode, today]);

  // Calendar sharing handlers
  const loadCalendarShares = async () => {
    setLoadingCalendarShares(true);
    try {
      const data = await mealPlanApi.listShares();
      setCalendarShares(data);
    } catch (error) {
      console.error('Failed to load calendar shares:', error);
    } finally {
      setLoadingCalendarShares(false);
    }
  };

  const openCalendarShareModal = () => {
    setIsCalendarShareModalOpen(true);
    loadCalendarShares();
  };

  // Calendar user search
  useEffect(() => {
    if (!calendarUserSearchQuery.trim()) {
      setCalendarUserSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingCalendarUsers(true);
      try {
        const results = await socialApi.searchUsers(calendarUserSearchQuery, 10);
        const shareUserIds = new Set(calendarShares.map(s => s.shared_with.id));
        setCalendarUserSearchResults(results.filter(u => !shareUserIds.has(u.id)));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchingCalendarUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [calendarUserSearchQuery, calendarShares]);

  const handleShareCalendar = async (userId: string, permission: 'viewer' | 'editor' = 'viewer') => {
    setSharingCalendarUser(userId);
    try {
      const newShare = await mealPlanApi.share({ user_id: userId, permission });
      setCalendarShares(prev => [...prev, newShare]);
      setCalendarUserSearchQuery('');
      setCalendarUserSearchResults([]);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to share calendar');
    } finally {
      setSharingCalendarUser(null);
    }
  };

  const handleUpdateCalendarSharePermission = async (userId: string, permission: 'viewer' | 'editor') => {
    try {
      const updated = await mealPlanApi.updateShare(userId, { permission });
      setCalendarShares(prev => prev.map(s => s.shared_with.id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemoveCalendarShare = async (userId: string) => {
    if (!confirm('Remove this user from your meal plan?')) return;
    try {
      await mealPlanApi.removeShare(userId);
      setCalendarShares(prev => prev.filter(s => s.shared_with.id !== userId));
    } catch (error) {
      console.error('Failed to remove share:', error);
    }
  };

  // Handle opening repeat modal
  const handleOpenRepeatModal = (meal: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRepeatMeal(meal);
    setRepeatWeeksCount(4);
    setShowRepeatModal(true);
  };

  // Handle creating recurring meals
  const handleCreateRecurring = async () => {
    if (!repeatMeal) return;
    setCreatingRecurring(true);
    try {
      // Get the day of week from the meal's planned_date (0=Monday, 6=Sunday)
      const mealDate = new Date(repeatMeal.planned_date + 'T00:00:00');
      const jsDay = mealDate.getDay(); // JS: 0=Sunday, 6=Saturday
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Monday, 6=Sunday

      // Start from next week (the week after the meal)
      const startDate = new Date(mealDate);
      startDate.setDate(startDate.getDate() + 7);

      // End date is start + (weeks - 1) * 7 days
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (repeatWeeksCount - 1) * 7);

      const newMeals = await mealPlanApi.createRecurring({
        recipe_id: repeatMeal.recipe.id,
        meal_type: repeatMeal.meal_type,
        day_of_week: dayOfWeek,
        start_date: formatDateForApi(startDate),
        end_date: formatDateForApi(endDate),
        servings: repeatMeal.servings,
      });

      // Add new meals to state
      setMealPlans(prev => [...prev, ...newMeals]);
      setShowRepeatModal(false);
      setRepeatMeal(null);
    } catch (error) {
      console.error('Failed to create recurring meals:', error);
      alert('Failed to create recurring meals');
    } finally {
      setCreatingRecurring(false);
    }
  };

  // ============================================================================
  // END CALENDAR LOGIC
  // ============================================================================

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCollectionClick = (collectionId: string | null) => {
    if (isManageMode) return;
    setSelectedCollection(collectionId);
    setCurrentPage(1);
  };

  // Collection CRUD handlers
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setSavingCollection(true);
    try {
      const newCollection = await collectionApi.create({ name: newCollectionName.trim() });
      setCollections(prev => [...prev, newCollection]);
      setNewCollectionName('');
      setIsCreatingCollection(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
    } finally {
      setSavingCollection(false);
    }
  };

  const handleUpdateCollection = async (collectionId: string) => {
    if (!editingCollectionName.trim()) return;
    setSavingCollection(true);
    try {
      const updated = await collectionApi.update(collectionId, { name: editingCollectionName.trim() });
      setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, name: updated.name } : c));
      setEditingCollectionId(null);
      setEditingCollectionName('');
    } catch (error) {
      console.error('Failed to update collection:', error);
    } finally {
      setSavingCollection(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Delete this collection? Recipes will not be deleted.')) return;
    try {
      await collectionApi.delete(collectionId);
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete collection');
    }
  };

  const startEditingCollection = (collection: Collection) => {
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  };

  const toggleCollectionPrivacy = async (collection: Collection) => {
    try {
      const newPrivacy = collection.privacy_level === 'public' ? 'private' : 'public';
      await collectionApi.update(collection.id, { privacy_level: newPrivacy });
      setCollections(prev => prev.map(c =>
        c.id === collection.id ? { ...c, privacy_level: newPrivacy } : c
      ));
    } catch (error) {
      console.error('Failed to update collection privacy:', error);
    }
  };

  // Recipe management handlers
  const handleRemoveRecipeFromCollection = async (recipeId: string, recipeName: string) => {
    // Use managingCollectionId if side panel is open, otherwise use selectedCollection
    const collectionId = managingCollectionId || selectedCollection;
    if (!collectionId) return;

    if (!confirm(`Remove "${recipeName}" from this collection?`)) return;

    setSavingRecipes(recipeId);

    try {
      await collectionApi.removeRecipe(collectionId, recipeId);
      setCollectionRecipeIds(prev => {
        const next = new Set(prev);
        next.delete(recipeId);
        return next;
      });
      // Update collection count
      setCollections(prev => prev.map(c =>
        c.id === collectionId
          ? { ...c, recipe_count: c.recipe_count - 1 }
          : c
      ));
      // Remove from displayed recipes if viewing this collection
      if (selectedCollection === collectionId) {
        setAllRecipes(prev => prev.filter(r => r.id !== recipeId));
      }
    } catch (error) {
      console.error('Failed to remove recipe from collection:', error);
    } finally {
      setSavingRecipes(null);
    }
  };

  const togglePrivacy = async (recipe: RecipeSummary, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const newPrivacy = recipe.privacy_level === 'public' ? 'private' : 'public';
      await recipeApi.update(recipe.id, { privacy_level: newPrivacy });
      setAllRecipes(prev => prev.map(r =>
        r.id === recipe.id ? { ...r, privacy_level: newPrivacy } : r
      ));
    } catch (error) {
      console.error('Failed to update privacy:', error);
    }
  };

  const selectedCollectionName = selectedCollection
    ? collections.find(c => c.id === selectedCollection)?.name ||
      sharedCollections.find(c => c.id === selectedCollection)?.name
    : null;

  const managingCollection = managingCollectionId
    ? collections.find(c => c.id === managingCollectionId)
    : null;

  // Determine if selected collection is a shared one (not owned by user)
  const selectedSharedCollection = selectedCollection
    ? sharedCollections.find(c => c.id === selectedCollection)
    : null;
  const isSharedCollection = !!selectedSharedCollection;
  const selectedOwnCollection = selectedCollection
    ? collections.find(c => c.id === selectedCollection)
    : null;
  const canShare = selectedOwnCollection || (selectedSharedCollection?.permission === 'editor');
  const canEditCollection = canShare; // Same permission level allows editing recipes in collection

  // Load shares when modal opens
  const loadShares = async () => {
    if (!selectedCollection) return;
    setLoadingShares(true);
    try {
      const data = await collectionApi.listShares(selectedCollection);
      setShares(data);
    } catch (error) {
      console.error('Failed to load shares:', error);
    } finally {
      setLoadingShares(false);
    }
  };

  const openShareModal = () => {
    setIsShareModalOpen(true);
    loadShares();
  };

  // User search for sharing
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const results = await socialApi.searchUsers(userSearchQuery, 10);
        // Filter out users who already have access
        const shareUserIds = new Set(shares.map(s => s.user_id));
        setUserSearchResults(results.filter(u => !shareUserIds.has(u.id)));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearchQuery, shares]);

  const handleShareWithUser = async (userId: string, permission: 'viewer' | 'editor' = 'viewer') => {
    if (!selectedCollection) return;
    setSharingUser(userId);
    try {
      const newShare = await collectionApi.share(selectedCollection, { user_id: userId, permission });
      setShares(prev => [...prev, newShare]);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to share collection');
    } finally {
      setSharingUser(null);
    }
  };

  const handleUpdatePermission = async (userId: string, permission: 'viewer' | 'editor') => {
    if (!selectedCollection) return;
    try {
      const updated = await collectionApi.updateShare(selectedCollection, userId, { permission });
      setShares(prev => prev.map(s => s.user_id === userId ? updated : s));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    if (!selectedCollection) return;
    if (!confirm('Remove this user from the collection?')) return;
    try {
      await collectionApi.removeShare(selectedCollection, userId);
      setShares(prev => prev.filter(s => s.user_id !== userId));
    } catch (error) {
      console.error('Failed to remove share:', error);
    }
  };

  const handleLeaveCollection = async () => {
    if (!selectedCollection) return;
    if (!confirm('Leave this collection? You will no longer have access to it.')) return;
    try {
      await collectionApi.leave(selectedCollection);
      setSharedCollections(prev => prev.filter(c => c.id !== selectedCollection));
      setSelectedCollection(null);
    } catch (error) {
      console.error('Failed to leave collection:', error);
    }
  };

  // Get all user recipes for the management panel
  const [allUserRecipes, setAllUserRecipes] = useState<RecipeSummary[]>([]);
  useEffect(() => {
    if (managingCollectionId) {
      recipeApi.list({ page: 1, page_size: 100 }).then(res => {
        setAllUserRecipes(res.items);
      });
    }
  }, [managingCollectionId]);

  // Load collection recipe IDs when add recipes modal opens
  useEffect(() => {
    if (isAddRecipesModalOpen && selectedCollection) {
      loadCollectionRecipes(selectedCollection);
    }
  }, [isAddRecipesModalOpen, selectedCollection]);

  // Handler for adding a recipe to collection (used by RecipeSearchModal)
  const handleAddRecipeToCollection = async (recipe: SearchRecipeResult) => {
    if (!selectedCollection) return;
    try {
      await collectionApi.addRecipe(selectedCollection, recipe.id);
      setCollectionRecipeIds(prev => new Set([...prev, recipe.id]));
      // Update collection count
      setCollections(prev => prev.map(c =>
        c.id === selectedCollection
          ? { ...c, recipe_count: c.recipe_count + 1 }
          : c
      ));
      // Fetch the full recipe data to add to display
      const fullRecipe = await recipeApi.get(recipe.id);
      setAllRecipes(prev => [...prev, fullRecipe]);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to add recipe to collection');
      throw error; // Re-throw so the modal knows it failed
    }
  };

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* Left Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              {/* View Toggle */}
              <div className="flex rounded-lg bg-cream-dark p-1 mb-4">
                <button
                  onClick={() => setPageView('recipes')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pageView === 'recipes'
                      ? 'bg-white text-charcoal shadow-sm'
                      : 'text-warm-gray hover:text-charcoal'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Recipes
                </button>
                <button
                  onClick={() => setPageView('calendar')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pageView === 'calendar'
                      ? 'bg-white text-charcoal shadow-sm'
                      : 'text-warm-gray hover:text-charcoal'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Meal Plan
                </button>
              </div>

              {/* Recipe sidebar content - only show when in recipes view */}
              {pageView === 'recipes' && (
              <nav className="space-y-1">
                {!isManageMode && (
                  <button
                    onClick={() => handleCollectionClick(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      !selectedCollection
                        ? 'bg-gold/10 text-gold-dark font-medium'
                        : 'text-charcoal hover:bg-cream-dark'
                    }`}
                  >
                    All Recipes
                  </button>
                )}

                <div className="mt-4 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-warm-gray uppercase tracking-wide px-3">Collections</span>
                    <button
                      onClick={() => setIsManageMode(!isManageMode)}
                      className={`text-xs transition-colors pr-3 ${isManageMode ? 'text-gold font-medium' : 'text-warm-gray hover:text-gold'}`}
                    >
                      {isManageMode ? 'Done' : 'Manage'}
                    </button>
                  </div>
                </div>

                {loadingCollections ? (
                  <div className="px-3 py-2">
                    <div className="animate-pulse h-4 bg-cream-dark rounded w-3/4" />
                  </div>
                ) : (
                  collections.map(collection => (
                    <div key={collection.id} className="group relative">
                      {editingCollectionId === collection.id ? (
                        <div className="flex items-center gap-1 px-2">
                          <input
                            ref={editCollectionInputRef}
                            type="text"
                            value={editingCollectionName}
                            onChange={(e) => setEditingCollectionName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateCollection(collection.id);
                              if (e.key === 'Escape') {
                                setEditingCollectionId(null);
                                setEditingCollectionName('');
                              }
                            }}
                            className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
                            disabled={savingCollection}
                          />
                          <button
                            onClick={() => handleUpdateCollection(collection.id)}
                            disabled={savingCollection}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingCollectionId(null);
                              setEditingCollectionName('');
                            }}
                            className="p-1 text-warm-gray hover:text-charcoal"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : isManageMode ? (
                        <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-cream-dark group/item">
                          {/* Drag Handle */}
                          <div className="flex-shrink-0 cursor-grab text-warm-gray/40 hover:text-warm-gray">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>

                          {/* Name and Privacy */}
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => setManagingCollectionId(collection.id)}
                              className="block w-full text-left truncate text-charcoal hover:text-gold transition-colors"
                            >
                              {collection.name}
                            </button>
                            <button
                              onClick={() => toggleCollectionPrivacy(collection)}
                              className={`text-[10px] font-medium transition-colors ${
                                collection.privacy_level === 'public'
                                  ? 'text-green-600 hover:text-green-700'
                                  : 'text-warm-gray hover:text-charcoal'
                              }`}
                              title={`Click to make ${collection.privacy_level === 'public' ? 'private' : 'public'}`}
                            >
                              {collection.privacy_level === 'public' ? 'Public' : 'Private'}
                            </button>
                          </div>

                          {/* Edit/Delete Actions */}
                          {!collection.is_default && (
                            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditingCollection(collection)}
                                className="p-1 text-warm-gray hover:text-gold"
                                title="Rename"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteCollection(collection.id)}
                                className="p-1 text-warm-gray hover:text-red-500"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCollectionClick(collection.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selectedCollection === collection.id
                              ? 'bg-gold/10 text-gold-dark font-medium'
                              : 'text-charcoal hover:bg-cream-dark'
                          }`}
                        >
                          <span className="truncate">{collection.name}</span>
                        </button>
                      )}
                    </div>
                  ))
                )}

                {/* New Collection Input */}
                {isCreatingCollection ? (
                  <div className="flex items-center gap-1 px-2">
                    <input
                      ref={newCollectionInputRef}
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateCollection();
                        if (e.key === 'Escape') {
                          setIsCreatingCollection(false);
                          setNewCollectionName('');
                        }
                      }}
                      placeholder="Collection name..."
                      className="flex-1 px-2 py-1.5 text-sm border border-gold rounded focus:outline-none"
                      disabled={savingCollection}
                    />
                    <button
                      onClick={handleCreateCollection}
                      disabled={savingCollection || !newCollectionName.trim()}
                      className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingCollection(false);
                        setNewCollectionName('');
                      }}
                      className="p-1 text-warm-gray hover:text-charcoal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreatingCollection(true)}
                    className="block w-full text-left px-3 py-2 text-sm text-gold hover:text-gold-dark"
                  >
                    + New Collection
                  </button>
                )}

                {/* Shared with me section */}
                {sharedCollections.length > 0 && (
                  <>
                    <div className="mt-6 mb-2 px-3">
                      <span className="text-xs font-medium text-warm-gray uppercase tracking-wide">Shared with me</span>
                    </div>
                    {sharedCollections.map(collection => (
                      <button
                        key={collection.id}
                        onClick={() => handleCollectionClick(collection.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedCollection === collection.id
                            ? 'bg-gold/10 text-gold-dark font-medium'
                            : 'text-charcoal hover:bg-cream-dark'
                        }`}
                      >
                        <span className="truncate block">{collection.name}</span>
                        <span className="text-[10px] text-warm-gray">by {collection.owner.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </nav>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {pageView === 'recipes' ? (
            <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-serif text-2xl text-charcoal">
                    {selectedCollectionName || 'All Recipes'}
                  </h1>
                  {/* Shared badge for shared collections */}
                  {isSharedCollection && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      Shared by {selectedSharedCollection?.owner.name}
                    </span>
                  )}
                </div>
                {!loading && (
                  <p className="text-sm text-warm-gray mt-1">
                    {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
                    {(searchQuery || selectedTags.length > 0) && ' filtered'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Collection action buttons */}
                {selectedCollection && (
                  <>
                    {canEditCollection && (
                      <button
                        onClick={() => setIsAddRecipesModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-charcoal hover:border-gold transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Recipes
                      </button>
                    )}
                    {canShare && (
                      <button
                        onClick={openShareModal}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-charcoal hover:border-gold transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Share
                      </button>
                    )}
                    {isSharedCollection && (
                      <button
                        onClick={handleLeaveCollection}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Leave
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Spotlight Filter */}
            <div className="mb-6 space-y-3">
              <div className="relative inline-flex items-center">
                <svg
                  className="w-4 h-4 text-warm-gray/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-charcoal placeholder:text-warm-gray/50 pl-2 pr-6 py-1 w-40 focus:w-64 transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-0 text-warm-gray/60 hover:text-charcoal"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
              </div>

              {/* Tag Pills with AND/OR Toggle */}
              {availableTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-gold text-white'
                          : 'bg-cream-dark text-charcoal hover:bg-gold/20'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {selectedTags.length > 1 && (
                    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
                      <span className="text-xs text-warm-gray">Match:</span>
                      <button
                        onClick={() => setTagFilterMode(tagFilterMode === 'all' ? 'any' : 'all')}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-cream-dark text-charcoal hover:bg-gold/20 transition-colors"
                      >
                        {tagFilterMode === 'all' ? 'All tags' : 'Any tag'}
                      </button>
                    </div>
                  )}
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recipe Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-3" />
                    <div className="h-4 bg-cream-dark rounded w-3/4 mb-2" />
                    <div className="h-3 bg-cream-dark rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center">
                  <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-charcoal mb-2">
                  {(searchQuery || selectedTags.length > 0)
                    ? 'No recipes match your filters'
                    : selectedCollection
                    ? 'No recipes in this collection'
                    : 'No recipes yet'}
                </h3>
                <p className="text-warm-gray mb-6">
                  {(searchQuery || selectedTags.length > 0)
                    ? 'Try adjusting your search or clearing filters'
                    : selectedCollection
                    ? 'Add some recipes to this collection to see them here'
                    : 'Create your first recipe to get started'
                  }
                </p>
                {(searchQuery || selectedTags.length > 0) ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTags([]);
                    }}
                    className="btn-secondary"
                  >
                    Clear Filters
                  </button>
                ) : !selectedCollection && (
                  <Link href="/recipes/new" className="btn-primary">
                    + New Recipe
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecipes.map(recipe => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="group"
                  >
                    <div className="aspect-[4/3] rounded-lg overflow-hidden mb-3 bg-cream-dark relative">
                      {recipe.cover_image_url ? (
                        <img
                          src={recipe.cover_image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {/* Remove from Collection Button - shown in manage mode when viewing a collection */}
                      {isManageMode && selectedCollection && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveRecipeFromCollection(recipe.id, recipe.title);
                          }}
                          disabled={savingRecipes === recipe.id}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                          title="Remove from collection"
                        >
                          {savingRecipes === recipe.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      )}
                      {/* Privacy Badge - display only (edit via recipe detail page) */}
                      {!(isManageMode && selectedCollection) && (
                        <span
                          className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            recipe.privacy_level === 'public'
                              ? 'bg-green-100/90 text-green-700'
                              : 'bg-gray-100/90 text-gray-600'
                          }`}
                        >
                          {recipe.privacy_level === 'public' ? (
                            <span className="flex items-center gap-0.5">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Public
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Private
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-lg text-charcoal group-hover:text-gold transition-colors mb-1">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-sm text-warm-gray line-clamp-2 mb-2">{recipe.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-warm-gray">
                      {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                        <span>{(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min</span>
                      )}
                      {recipe.difficulty && (
                        <span className={`capitalize ${
                          recipe.difficulty === 'easy' ? 'text-green-600' :
                          recipe.difficulty === 'medium' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {recipe.difficulty}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!selectedCollection && totalPages > 1 && !searchQuery && selectedTags.length === 0 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-charcoal hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 text-sm text-warm-gray">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-charcoal hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
            </>
            ) : (
            /* Calendar View */
            <div>
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-serif text-2xl text-charcoal">Meal Plan</h1>

                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-cream-dark rounded-lg p-1">
                  {(['day', 'week', 'month'] as CalendarViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setCalendarViewMode(mode)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                        calendarViewMode === mode ? 'bg-white text-charcoal shadow-sm' : 'text-warm-gray hover:text-charcoal'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Navigation & Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={openCalendarShareModal}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg text-charcoal hover:border-gold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Share
                  </button>
                  {!isCurrentPeriod && (
                    <button onClick={goToToday} className="px-3 py-1.5 text-sm text-gold hover:text-gold-dark transition-colors">
                      Today
                    </button>
                  )}
                  {calendarViewMode === 'week' && (
                    <button
                      onClick={() => setShowCopyWeeksModal(true)}
                      className="p-2 text-warm-gray hover:text-charcoal transition-colors"
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
                  <span className="text-sm font-medium text-charcoal min-w-[180px] text-center">
                    {calendarHeaderText}
                  </span>
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
                  <button onClick={() => setClipboard(null)} className="text-warm-gray hover:text-charcoal text-sm">
                    Cancel
                  </button>
                </div>
              )}

              {/* Week View - Desktop (7-day) */}
              {calendarViewMode === 'week' && (
                <div className="hidden md:block bg-white rounded-xl border border-border overflow-hidden">
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
                      {weekDates.map((date, dayIndex) => {
                        const meals = getMealsForSlot(date, mealType);
                        const dateStr = formatDateForApi(date);
                        const isDragOver = dragOverSlot?.date === dateStr && dragOverSlot?.mealType === mealType;
                        const past = isPast(date);

                        return (
                          <div
                            key={dayIndex}
                            className={`min-h-[100px] p-2 border-r border-border last:border-r-0 transition-colors ${
                              isToday(date) ? 'bg-gold/5' : past ? 'bg-gray-50' : ''
                            } ${isDragOver ? 'bg-gold/20' : ''} ${clipboard ? 'cursor-pointer' : ''}`}
                            onDragOver={(e) => handleDragOver(date, mealType, e)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(date, mealType, e)}
                            onClick={() => clipboard && handlePaste(date, mealType)}
                          >
                            {loadingMealPlans ? (
                              <div className="animate-pulse bg-cream-dark rounded-lg h-16" />
                            ) : meals.length > 0 ? (
                              <div className="space-y-2">
                                {meals.map(meal => (
                                  <div
                                    key={meal.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(meal, e)}
                                    onDragEnd={handleDragEnd}
                                    className={`group relative rounded-lg p-2 transition-all cursor-grab active:cursor-grabbing bg-cream hover:bg-cream-dark ${
                                      draggedMeal?.id === meal.id ? 'opacity-50 scale-95' : ''
                                    } ${clipboard?.meal.id === meal.id ? 'ring-2 ring-gold ring-offset-1' : ''}`}
                                  >
                                    {meal.recipe.cover_image_url && (
                                      <div className="aspect-video rounded overflow-hidden mb-1.5">
                                        <img src={meal.recipe.cover_image_url} alt={meal.recipe.title} className="w-full h-full object-cover" />
                                      </div>
                                    )}
                                    <Link
                                      href={`/recipes/${meal.recipe.id}`}
                                      className="font-medium text-charcoal hover:text-gold block text-xs line-clamp-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {meal.recipe.title}
                                    </Link>
                                    <div className="text-[10px] text-warm-gray mt-0.5">{meal.servings} servings</div>
                                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => handleCopy(meal, e)} className="p-1 rounded bg-white/80 text-warm-gray hover:text-gold" title="Copy">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                      <button onClick={(e) => handleCut(meal, e)} className="p-1 rounded bg-white/80 text-warm-gray hover:text-orange-500" title="Cut">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                                        </svg>
                                      </button>
                                      <button onClick={(e) => handleOpenRepeatModal(meal, e)} className="p-1 rounded bg-white/80 text-warm-gray hover:text-blue-500" title="Repeat">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      </button>
                                      <button onClick={(e) => handleDeleteMeal(meal.id, e)} className="p-1 rounded bg-white/80 text-warm-gray hover:text-red-500" title="Delete">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCalendarSlotClick(date, mealType); }}
                                  className="w-full py-1 text-xs text-warm-gray hover:text-gold transition-colors"
                                >
                                  + Add
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCalendarSlotClick(date, mealType); }}
                                className={`w-full h-full min-h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center transition-colors group ${
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
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Week View - Mobile (3-day) */}
              {calendarViewMode === 'week' && (
                <div className="md:hidden">
                  {/* Mobile Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={goMobile3DayPrev} className="p-2 text-warm-gray hover:text-charcoal">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="text-center">
                      <span className="text-sm font-medium text-charcoal">
                        {mobile3DayDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {mobile3DayDates[2].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {mobile3DayOffset !== 0 && (
                        <button onClick={goMobile3DayToday} className="ml-2 text-xs text-gold">
                          Today
                        </button>
                      )}
                    </div>
                    <button onClick={goMobile3DayNext} className="p-2 text-warm-gray hover:text-charcoal">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* 3-Day Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {mobile3DayDates.map((date, index) => {
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
                            {loadingMealPlans ? (
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
                                          onClick={(e) => toggleMealActions(meal.id, e)}
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
                                                onClick={(e) => { e.stopPropagation(); handleOpenMoveModal(meal); }}
                                                className="text-xs text-charcoal hover:text-gold"
                                              >
                                                Move to...
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenRepeatModal(meal, e); }}
                                                className="text-xs text-charcoal hover:text-gold"
                                              >
                                                Repeat
                                              </button>
                                              <button
                                                onClick={(e) => handleDeleteMeal(meal.id, e)}
                                                className="text-xs text-red-500"
                                              >
                                                Remove
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedMealForActions(null); }}
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
                                    onClick={() => handleCalendarSlotClick(date, mealType)}
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
                                onClick={() => handleCalendarSlotClick(date, 'dinner')}
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
              )}

              {/* Day View */}
              {calendarViewMode === 'day' && (
                <div className="bg-white rounded-xl border border-border overflow-hidden max-w-2xl mx-auto">
                  <div className={`px-6 py-4 border-b border-border ${isToday(currentDate) ? 'bg-gold/10' : isPast(currentDate) ? 'bg-gray-50' : ''}`}>
                    <div className={`text-2xl font-serif ${isToday(currentDate) ? 'text-gold-dark' : isPast(currentDate) ? 'text-gray-400' : 'text-charcoal'}`}>
                      {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
                    </div>
                    <div className={`text-sm ${isPast(currentDate) ? 'text-gray-400' : 'text-warm-gray'}`}>
                      {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  {MEAL_TYPES.map(({ key: mealType, label }) => {
                    const meals = getMealsForSlot(currentDate, mealType);
                    return (
                      <div key={mealType} className="border-b border-border last:border-b-0">
                        <div className="px-6 py-3 bg-cream-dark">
                          <span className="text-sm font-medium text-charcoal">{label}</span>
                        </div>
                        <div className="p-4">
                          {meals.length > 0 ? (
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
                                    <button onClick={(e) => handleOpenRepeatModal(meal, e)} className="text-warm-gray hover:text-blue-500" title="Repeat weekly">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    </button>
                                    <button onClick={(e) => handleDeleteMeal(meal.id, e)} className="text-warm-gray hover:text-red-500" title="Remove">
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
                              onClick={() => handleCalendarSlotClick(currentDate, mealType)}
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
              )}

              {/* Month View - Desktop */}
              {calendarViewMode === 'month' && (
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
                              onClick={() => handleCalendarSlotClick(date, 'dinner')}
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
              )}

              {/* Month View - Mobile (Mini Calendar + Day Detail) */}
              {calendarViewMode === 'month' && (
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
                            onClick={() => setMobileSelectedDate(date)}
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
                            onClick={() => setMobileSelectedDate(null)}
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
                              {meals.length > 0 ? (
                                <div className="space-y-2">
                                  {meals.map(meal => (
                                    <div
                                      key={meal.id}
                                      className="relative flex items-center gap-3 p-2 rounded-lg bg-cream"
                                      onClick={(e) => toggleMealActions(meal.id, e)}
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
                                            onClick={(e) => { e.stopPropagation(); handleOpenMoveModal(meal); }}
                                            className="p-2 text-charcoal hover:text-gold"
                                          >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenRepeatModal(meal, e); }}
                                            className="p-2 text-charcoal hover:text-gold"
                                          >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => handleDeleteMeal(meal.id, e)}
                                            className="p-2 text-red-500"
                                          >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedMealForActions(null); }}
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
                                  onClick={() => handleCalendarSlotClick(mobileSelectedDate, mealType)}
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
              )}

              {/* Empty state */}
              {!loadingMealPlans && mealPlans.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-warm-gray">Click on a slot to add a recipe to your meal plan.</p>
                </div>
              )}
            </div>
            )}
          </main>

          {/* Right Panel - Recipe Management */}
          {pageView === 'recipes' && managingCollectionId && (
            <aside className="hidden lg:block w-80 flex-shrink-0">
              <div className="sticky top-24 bg-white border border-border rounded-lg p-4 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg text-charcoal">
                    {managingCollection?.name}
                  </h3>
                  <button
                    onClick={() => setManagingCollectionId(null)}
                    className="text-warm-gray hover:text-charcoal"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 -mx-4 px-4">
                  <p className="text-xs text-warm-gray mb-3">
                    {collectionRecipeIds.size} recipe{collectionRecipeIds.size !== 1 ? 's' : ''} in this collection
                  </p>
                  <div className="space-y-2">
                    {allUserRecipes
                      .filter(r => collectionRecipeIds.has(r.id))
                      .map(recipe => (
                        <div
                          key={recipe.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream group/item"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-charcoal truncate">{recipe.title}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveRecipeFromCollection(recipe.id, recipe.title)}
                            disabled={savingRecipes === recipe.id}
                            className="text-warm-gray hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all disabled:opacity-50"
                            title="Remove from collection"
                          >
                            {savingRecipes === recipe.id ? (
                              <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    {collectionRecipeIds.size === 0 && (
                      <p className="text-sm text-warm-gray italic py-4 text-center">
                        No recipes in this collection
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Floating Action Button - New Recipe (desktop only, mobile uses bottom nav) */}
      {pageView === 'recipes' && (
      <Link
        href={selectedCollection ? `/recipes/new?collection=${selectedCollection}` : "/recipes/new"}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gold hover:bg-gold-dark text-white rounded-full shadow-lg hover:shadow-xl hidden md:flex items-center justify-center transition-all duration-200 hover:scale-105"
        title="New Recipe"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </Link>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-serif text-lg text-charcoal">Share Collection</h2>
              <button
                onClick={() => {
                  setIsShareModalOpen(false);
                  setUserSearchQuery('');
                  setUserSearchResults([]);
                }}
                className="text-warm-gray hover:text-charcoal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* User Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Add people
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name or username..."
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-gold"
                  />
                  {searchingUsers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {userSearchResults.length > 0 && (
                  <div className="mt-2 border border-border rounded-lg divide-y divide-border">
                    {userSearchResults.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          {user.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center">
                              <span className="text-xs font-medium text-charcoal">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-charcoal">{user.name}</p>
                            {user.username && (
                              <p className="text-xs text-warm-gray">@{user.username}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleShareWithUser(user.id, 'viewer')}
                            disabled={sharingUser === user.id}
                            className="px-2 py-1 text-xs border border-border rounded hover:border-gold transition-colors disabled:opacity-50"
                          >
                            {sharingUser === user.id ? '...' : 'Viewer'}
                          </button>
                          <button
                            onClick={() => handleShareWithUser(user.id, 'editor')}
                            disabled={sharingUser === user.id}
                            className="px-2 py-1 text-xs bg-gold text-white rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
                          >
                            {sharingUser === user.id ? '...' : 'Editor'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Shares */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  People with access
                </label>
                {loadingShares ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : shares.length === 0 ? (
                  <p className="text-sm text-warm-gray text-center py-4">
                    No one else has access yet
                  </p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {shares.map(share => (
                      <div key={share.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          {share.user.profile_image_url ? (
                            <img
                              src={share.user.profile_image_url}
                              alt={share.user.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center">
                              <span className="text-xs font-medium text-charcoal">
                                {share.user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-charcoal">{share.user.name}</p>
                            {share.user.username && (
                              <p className="text-xs text-warm-gray">@{share.user.username}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={share.permission}
                            onChange={(e) => handleUpdatePermission(share.user_id, e.target.value as 'viewer' | 'editor')}
                            className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:border-gold"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            onClick={() => handleRemoveShare(share.user_id)}
                            className="p-1 text-warm-gray hover:text-red-500"
                            title="Remove access"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border">
              <button
                onClick={() => {
                  setIsShareModalOpen(false);
                  setUserSearchQuery('');
                  setUserSearchResults([]);
                }}
                className="w-full py-2 bg-charcoal text-white rounded-lg text-sm hover:bg-charcoal/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Recipes Modal */}
      <RecipeSearchModal
        isOpen={isAddRecipesModalOpen}
        onClose={() => setIsAddRecipesModalOpen(false)}
        onSelectRecipe={handleAddRecipeToCollection}
        excludeRecipeIds={collectionRecipeIds}
        title="Add Recipe to Collection"
      />

      {/* Calendar Add Recipe Modal */}
      <RecipeSearchModal
        isOpen={isCalendarAddModalOpen}
        onClose={() => {
          setIsCalendarAddModalOpen(false);
          setCalendarSelectedSlot(null);
        }}
        onSelectRecipe={handleCalendarSelectRecipe}
        title={calendarSelectedSlot ? `Add ${calendarSelectedSlot.mealType} for ${calendarSelectedSlot.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Add Recipe'}
      />

      {/* Copy Weeks Modal */}
      {showCopyWeeksModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h2 className="font-serif text-lg text-charcoal mb-4">Copy Week to Future</h2>
            <p className="text-sm text-warm-gray mb-4">
              Copy this week's meal plan to the next few weeks.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-charcoal mb-2">
                Number of weeks to copy
              </label>
              <select
                value={copyWeeksCount}
                onChange={(e) => setCopyWeeksCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-gold"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n} week{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCopyWeeksModal(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-charcoal hover:border-gold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyWeeks}
                disabled={copyingWeeks}
                className="flex-1 py-2 bg-gold text-white rounded-lg text-sm hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                {copyingWeeks ? 'Copying...' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Share Modal */}
      {isCalendarShareModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-serif text-lg text-charcoal">Share Meal Plan</h2>
              <button
                onClick={() => {
                  setIsCalendarShareModalOpen(false);
                  setCalendarUserSearchQuery('');
                  setCalendarUserSearchResults([]);
                }}
                className="text-warm-gray hover:text-charcoal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* User Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Add people
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={calendarUserSearchQuery}
                    onChange={(e) => setCalendarUserSearchQuery(e.target.value)}
                    placeholder="Search by name or username..."
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-gold"
                  />
                  {searchingCalendarUsers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {calendarUserSearchResults.length > 0 && (
                  <div className="mt-2 border border-border rounded-lg divide-y divide-border">
                    {calendarUserSearchResults.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          {user.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center">
                              <span className="text-xs font-medium text-charcoal">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-charcoal">{user.name}</p>
                            {user.username && (
                              <p className="text-xs text-warm-gray">@{user.username}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleShareCalendar(user.id, 'viewer')}
                            disabled={sharingCalendarUser === user.id}
                            className="px-2 py-1 text-xs border border-border rounded hover:border-gold transition-colors disabled:opacity-50"
                          >
                            {sharingCalendarUser === user.id ? '...' : 'Viewer'}
                          </button>
                          <button
                            onClick={() => handleShareCalendar(user.id, 'editor')}
                            disabled={sharingCalendarUser === user.id}
                            className="px-2 py-1 text-xs bg-gold text-white rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
                          >
                            {sharingCalendarUser === user.id ? '...' : 'Editor'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Shares */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  People with access
                </label>
                {loadingCalendarShares ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : calendarShares.length === 0 ? (
                  <p className="text-sm text-warm-gray text-center py-4">
                    No one else has access yet
                  </p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {calendarShares.map(share => (
                      <div key={share.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          {share.shared_with.profile_image_url ? (
                            <img
                              src={share.shared_with.profile_image_url}
                              alt={share.shared_with.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center">
                              <span className="text-xs font-medium text-charcoal">
                                {share.shared_with.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-charcoal">{share.shared_with.name}</p>
                            {share.shared_with.username && (
                              <p className="text-xs text-warm-gray">@{share.shared_with.username}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={share.permission}
                            onChange={(e) => handleUpdateCalendarSharePermission(share.shared_with.id, e.target.value as 'viewer' | 'editor')}
                            className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:border-gold"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            onClick={() => handleRemoveCalendarShare(share.shared_with.id)}
                            className="p-1 text-warm-gray hover:text-red-500"
                            title="Remove access"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border">
              <button
                onClick={() => {
                  setIsCalendarShareModalOpen(false);
                  setCalendarUserSearchQuery('');
                  setCalendarUserSearchResults([]);
                }}
                className="w-full py-2 bg-charcoal text-white rounded-lg text-sm hover:bg-charcoal/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repeat Meal Modal */}
      {showRepeatModal && repeatMeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif text-charcoal">Repeat Meal</h3>
                <button
                  onClick={() => {
                    setShowRepeatModal(false);
                    setRepeatMeal(null);
                  }}
                  className="text-warm-gray hover:text-charcoal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Recipe Info */}
              <div className="flex items-center gap-3 p-3 bg-cream rounded-lg">
                {repeatMeal.recipe.cover_image_url && (
                  <img
                    src={repeatMeal.recipe.cover_image_url}
                    alt=""
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-charcoal">{repeatMeal.recipe.title}</p>
                  <p className="text-sm text-warm-gray">
                    {new Date(repeatMeal.planned_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })} {repeatMeal.meal_type}
                  </p>
                </div>
              </div>

              {/* Weeks Selection */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Repeat for how many weeks?
                </label>
                <p className="text-xs text-warm-gray mb-3">
                  This will add the meal to the same day and time slot for the next {repeatWeeksCount} week{repeatWeeksCount > 1 ? 's' : ''}.
                </p>
                <div className="flex items-center gap-2">
                  {[1, 2, 4, 8, 12].map(weeks => (
                    <button
                      key={weeks}
                      onClick={() => setRepeatWeeksCount(weeks)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        repeatWeeksCount === weeks
                          ? 'bg-gold text-white border-gold'
                          : 'border-border text-charcoal hover:border-gold'
                      }`}
                    >
                      {weeks}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> This will create {repeatWeeksCount} new meal{repeatWeeksCount > 1 ? 's' : ''} on{' '}
                  {new Date(repeatMeal.planned_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}s,
                  starting from{' '}
                  {(() => {
                    const startDate = new Date(repeatMeal.planned_date + 'T00:00:00');
                    startDate.setDate(startDate.getDate() + 7);
                    return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  })()}.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  setShowRepeatModal(false);
                  setRepeatMeal(null);
                }}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-charcoal hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRecurring}
                disabled={creatingRecurring}
                className="flex-1 py-2 bg-gold text-white rounded-lg text-sm hover:bg-gold-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingRecurring ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Repeat {repeatWeeksCount} Week{repeatWeeksCount > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Meal Modal (Mobile) */}
      {showMoveModal && mealToMove && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif text-charcoal">Move Meal</h3>
                <button
                  onClick={() => {
                    setShowMoveModal(false);
                    setMealToMove(null);
                    setMoveDestination(null);
                  }}
                  className="text-warm-gray hover:text-charcoal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)]">
              {/* Recipe Info */}
              <div className="flex items-center gap-3 p-3 bg-cream rounded-lg">
                {mealToMove.recipe.cover_image_url && (
                  <img
                    src={mealToMove.recipe.cover_image_url}
                    alt=""
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-charcoal">{mealToMove.recipe.title}</p>
                  <p className="text-sm text-warm-gray">
                    Currently: {new Date(mealToMove.planned_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - {mealToMove.meal_type}
                  </p>
                </div>
              </div>

              {/* Date Selection - Next 14 days */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Select date
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 14 }, (_, i) => {
                    const date = new Date();
                    date.setHours(0, 0, 0, 0);
                    date.setDate(date.getDate() + i);
                    const isSelected = moveDestination?.date?.getTime() === date.getTime();
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <button
                        key={i}
                        onClick={() => setMoveDestination(prev => ({ date, mealType: prev?.mealType || mealToMove.meal_type }))}
                        className={`flex flex-col items-center p-2 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-gold text-white'
                            : i === 0
                            ? 'bg-gold/10 text-gold hover:bg-gold/20'
                            : 'hover:bg-cream'
                        }`}
                      >
                        <span className="text-[10px] uppercase opacity-70">{dayName}</span>
                        <span className="font-medium">{date.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Meal Type Selection */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Select meal type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_TYPES.map(({ key, label }) => {
                    const isSelected = moveDestination?.mealType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setMoveDestination(prev => prev ? { ...prev, mealType: key } : { date: new Date(), mealType: key })}
                        className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-gold text-white'
                            : 'border border-border text-charcoal hover:border-gold'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMealToMove(null);
                  setMoveDestination(null);
                }}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-charcoal hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (moveDestination?.date) {
                    handleMoveMeal(moveDestination.date, moveDestination.mealType);
                  }
                }}
                disabled={!moveDestination?.date}
                className="flex-1 py-2.5 bg-gold text-white rounded-lg text-sm hover:bg-gold-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-cream-dark rounded w-48 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-3" />
                  <div className="h-4 bg-cream-dark rounded w-3/4 mb-2" />
                  <div className="h-3 bg-cream-dark rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <RecipesPageContent />
    </Suspense>
  );
}
