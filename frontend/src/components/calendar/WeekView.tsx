'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MealPlan, MealType } from '@/types';
import { formatDateForApi } from '@/lib/calendar-utils';
import MealCard from './MealCard';
import InlineCellEditor from './InlineCellEditor';

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

interface CellPosition {
  dayIndex: number;
  mealTypeIndex: number;
}

interface WeekViewProps {
  weekDates: Date[];
  loading: boolean;
  clipboard: ClipboardState | null;
  draggedMeal: MealPlan | null;
  dragOverSlot: { date: string; mealType: MealType } | null;
  getMealsForSlot: (date: Date, mealType: MealType) => MealPlan[];
  isToday: (date: Date) => boolean;
  isPast: (date: Date) => boolean;
  onDragStart: (meal: MealPlan, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (date: Date, mealType: MealType, e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (date: Date, mealType: MealType, e: React.DragEvent) => void;
  onPaste: (date: Date, mealType: MealType) => void;
  onCopy: (meal: MealPlan, e: React.MouseEvent) => void;
  onCut: (meal: MealPlan, e: React.MouseEvent) => void;
  onRepeat: (meal: MealPlan, e: React.MouseEvent) => void;
  onDelete: (mealId: string, e: React.MouseEvent) => void;
  onEdit: (meal: MealPlan, e: React.MouseEvent) => void;
  onSlotClick: (date: Date, mealType: MealType) => void;
  // Keyboard-friendly handlers
  onKeyboardCopy?: (meal: MealPlan) => void;
  onKeyboardCut?: (meal: MealPlan) => void;
  onKeyboardDelete?: (mealId: string) => Promise<void>;
  onKeyboardEdit?: (meal: MealPlan) => void;
  // Inline editing
  onInlineMealCreated?: (meal: MealPlan) => void;
  defaultCalendarId?: string | null;
  defaultServings?: number;
}

export default function WeekView({
  weekDates,
  loading,
  clipboard,
  draggedMeal,
  dragOverSlot,
  getMealsForSlot,
  isToday,
  isPast,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onPaste,
  onCopy,
  onCut,
  onRepeat,
  onDelete,
  onEdit,
  onSlotClick,
  onKeyboardCopy,
  onKeyboardCut,
  onKeyboardDelete,
  onKeyboardEdit,
  onInlineMealCreated,
  defaultCalendarId,
  defaultServings = 4,
}: WeekViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [initialEditValue, setInitialEditValue] = useState('');

  // Clear selection when week changes
  useEffect(() => {
    setSelectedCell(null);
    setEditingCell(null);
  }, [weekDates]);

  const isSelected = useCallback((dayIndex: number, mealTypeIndex: number) => {
    return selectedCell?.dayIndex === dayIndex && selectedCell?.mealTypeIndex === mealTypeIndex;
  }, [selectedCell]);

  const isEditing = useCallback((dayIndex: number, mealTypeIndex: number) => {
    return editingCell?.dayIndex === dayIndex && editingCell?.mealTypeIndex === mealTypeIndex;
  }, [editingCell]);

  const startEditing = useCallback((dayIndex: number, mealTypeIndex: number, initial: string = '') => {
    setSelectedCell({ dayIndex, mealTypeIndex });
    setEditingCell({ dayIndex, mealTypeIndex });
    setInitialEditValue(initial);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingCell(null);
    setInitialEditValue('');
    // Refocus grid for continued keyboard nav
    setTimeout(() => gridRef.current?.focus(), 0);
  }, []);

  const handleCellClick = useCallback((dayIndex: number, mealTypeIndex: number, date: Date, mealType: MealType) => {
    // If clipboard active, paste
    if (clipboard) {
      onPaste(date, mealType);
      return;
    }

    const meals = getMealsForSlot(date, mealType);

    // Select the cell
    setSelectedCell({ dayIndex, mealTypeIndex });

    // If empty cell and inline editing is available, start editing
    if (meals.length === 0 && defaultCalendarId && onInlineMealCreated) {
      startEditing(dayIndex, mealTypeIndex);
    } else if (meals.length === 0) {
      // Fallback to modal if no calendar
      onSlotClick(date, mealType);
    }
  }, [clipboard, getMealsForSlot, defaultCalendarId, onInlineMealCreated, onPaste, onSlotClick, startEditing]);

  const handleInlineMealCreated = useCallback((meal: MealPlan) => {
    onInlineMealCreated?.(meal);
    stopEditing();
  }, [onInlineMealCreated, stopEditing]);

  // Keyboard navigation handler
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Don't handle if editing (input handles its own keys)
    if (editingCell) return;

    // If no cell selected, arrow keys start selection
    if (!selectedCell) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setSelectedCell({ dayIndex: 0, mealTypeIndex: 0 });
      }
      return;
    }

    const { dayIndex, mealTypeIndex } = selectedCell;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        if (dayIndex < 6) setSelectedCell({ dayIndex: dayIndex + 1, mealTypeIndex });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (dayIndex > 0) setSelectedCell({ dayIndex: dayIndex - 1, mealTypeIndex });
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (mealTypeIndex < 2) setSelectedCell({ dayIndex, mealTypeIndex: mealTypeIndex + 1 });
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (mealTypeIndex > 0) setSelectedCell({ dayIndex, mealTypeIndex: mealTypeIndex - 1 });
        break;
      case 'Enter': {
        e.preventDefault();
        const date = weekDates[dayIndex];
        const mealType = MEAL_TYPES[mealTypeIndex].key;
        const meals = getMealsForSlot(date, mealType);
        if (meals.length === 0 && defaultCalendarId && onInlineMealCreated) {
          startEditing(dayIndex, mealTypeIndex);
        } else if (meals.length === 0) {
          onSlotClick(date, mealType);
        } else if (onKeyboardEdit) {
          onKeyboardEdit(meals[0]);
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        setSelectedCell(null);
        gridRef.current?.blur();
        break;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const date = weekDates[dayIndex];
        const mealType = MEAL_TYPES[mealTypeIndex].key;
        const meals = getMealsForSlot(date, mealType);
        if (meals.length > 0 && onKeyboardDelete) {
          onKeyboardDelete(meals[0].id);
        }
        break;
      }
      default: {
        // Ctrl/Cmd + C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          const date = weekDates[dayIndex];
          const mealType = MEAL_TYPES[mealTypeIndex].key;
          const meals = getMealsForSlot(date, mealType);
          if (meals.length > 0 && onKeyboardCopy) {
            onKeyboardCopy(meals[0]);
          }
        }
        // Ctrl/Cmd + X
        else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
          e.preventDefault();
          const date = weekDates[dayIndex];
          const mealType = MEAL_TYPES[mealTypeIndex].key;
          const meals = getMealsForSlot(date, mealType);
          if (meals.length > 0 && onKeyboardCut) {
            onKeyboardCut(meals[0]);
          }
        }
        // Ctrl/Cmd + V
        else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          e.preventDefault();
          if (clipboard) {
            const date = weekDates[dayIndex];
            const mealType = MEAL_TYPES[mealTypeIndex].key;
            onPaste(date, mealType);
          }
        }
        // Typing a character starts inline editing on empty cells
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const date = weekDates[dayIndex];
          const mealType = MEAL_TYPES[mealTypeIndex].key;
          const meals = getMealsForSlot(date, mealType);
          if (meals.length === 0 && defaultCalendarId && onInlineMealCreated) {
            e.preventDefault();
            startEditing(dayIndex, mealTypeIndex, e.key);
          }
        }
        break;
      }
    }
  }, [selectedCell, editingCell, weekDates, getMealsForSlot, clipboard, onPaste, onSlotClick, onKeyboardCopy, onKeyboardCut, onKeyboardDelete, onKeyboardEdit, onInlineMealCreated, defaultCalendarId, startEditing]);

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
      className="hidden md:block bg-white rounded-xl border border-border overflow-hidden outline-none focus:ring-2 focus:ring-gold/30 focus:ring-offset-1 transition-shadow"
    >
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
      {MEAL_TYPES.map(({ key: mealType, label }, mealTypeIndex) => (
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
            const cellSelected = isSelected(dayIndex, mealTypeIndex);
            const cellEditing = isEditing(dayIndex, mealTypeIndex);

            return (
              <div
                key={dayIndex}
                className={`min-h-[100px] p-2 border-r border-border last:border-r-0 transition-all cursor-pointer ${
                  isToday(date) ? 'bg-gold/5' : past ? 'bg-gray-50' : ''
                } ${isDragOver ? 'bg-gold/20' : ''} ${
                  cellSelected && !cellEditing ? 'ring-2 ring-inset ring-gold shadow-sm' : ''
                } ${clipboard && !cellSelected ? 'hover:bg-gold/10' : ''}`}
                onDragOver={(e) => onDragOver(date, mealType, e)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(date, mealType, e)}
                onClick={() => handleCellClick(dayIndex, mealTypeIndex, date, mealType)}
              >
                {loading ? (
                  <div className="animate-pulse bg-cream-dark rounded-lg h-16" />
                ) : cellEditing && meals.length === 0 && defaultCalendarId ? (
                  <InlineCellEditor
                    date={date}
                    mealType={mealType}
                    calendarId={defaultCalendarId}
                    defaultServings={defaultServings}
                    onMealCreated={handleInlineMealCreated}
                    onClose={stopEditing}
                    initialValue={initialEditValue}
                  />
                ) : meals.length > 0 ? (
                  <div className="space-y-2">
                    {meals.map(meal => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        variant="desktop"
                        isDragging={draggedMeal?.id === meal.id}
                        isClipboard={clipboard?.meal.id === meal.id}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onCopy={onCopy}
                        onCut={onCut}
                        onRepeat={onRepeat}
                        onDelete={onDelete}
                        onEdit={onEdit}
                      />
                    ))}
                    <button
                      onClick={(e) => { e.stopPropagation(); onSlotClick(date, mealType); }}
                      className="w-full py-1 text-xs text-warm-gray hover:text-gold transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                ) : (
                  <div
                    className={`w-full h-full min-h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center transition-colors group ${
                      past ? 'border-gray-200 text-gray-300' : 'border-border text-warm-gray hover:border-gold hover:text-gold'
                    } ${clipboard ? 'border-gold border-solid bg-gold/10' : ''}`}
                  >
                    <svg className={`w-4 h-4 ${clipboard ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Keyboard hint */}
      {selectedCell && !editingCell && (
        <div className="px-4 py-1.5 bg-cream/60 border-t border-border flex items-center gap-4 text-[10px] text-warm-gray">
          <span><kbd className="px-1 py-0.5 bg-white rounded border border-border font-mono">Arrow keys</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 bg-white rounded border border-border font-mono">Enter</kbd> edit</span>
          <span><kbd className="px-1 py-0.5 bg-white rounded border border-border font-mono">Ctrl+C/V</kbd> copy/paste</span>
          <span><kbd className="px-1 py-0.5 bg-white rounded border border-border font-mono">Del</kbd> remove</span>
          <span><kbd className="px-1 py-0.5 bg-white rounded border border-border font-mono">Esc</kbd> deselect</span>
        </div>
      )}
    </div>
  );
}
