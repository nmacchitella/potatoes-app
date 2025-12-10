'use client';

import type { MealPlan, MealType } from '@/types';
import { formatDateForApi } from '@/lib/calendar-utils';
import MealCard from './MealCard';

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
  onSlotClick: (date: Date, mealType: MealType) => void;
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
  onSlotClick,
}: WeekViewProps) {
  return (
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
                onDragOver={(e) => onDragOver(date, mealType, e)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(date, mealType, e)}
                onClick={() => clipboard && onPaste(date, mealType)}
              >
                {loading ? (
                  <div className="animate-pulse bg-cream-dark rounded-lg h-16" />
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
                  <button
                    onClick={(e) => { e.stopPropagation(); onSlotClick(date, mealType); }}
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
  );
}
