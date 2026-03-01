'use client';

import { useCalendar } from '@/hooks';
import { getCalendarHeaderText, isCurrentMonth, MEAL_TYPES } from '@/lib/calendar-utils';
import { Modal } from '@/components/ui';
import CalendarHeader from './CalendarHeader';
import WeekView from './WeekView';
import MobileWeekView from './MobileWeekView';
import DayView from './DayView';
import MonthView from './MonthView';
import { AddMealModal } from './AddMealModal';

interface CalendarViewProps {
  isActive?: boolean;
  onOpenShareModal: () => void;
  calendarHook?: ReturnType<typeof useCalendar>;
}

export default function CalendarView({ isActive = true, onOpenShareModal, calendarHook }: CalendarViewProps) {
  // Use provided hook or create our own
  const internalCalendar = useCalendar(calendarHook ? false : isActive);
  const calendar = calendarHook || internalCalendar;

  const headerText = getCalendarHeaderText(calendar.currentDate, calendar.viewMode);

  return (
    <div>
      <CalendarHeader
        viewMode={calendar.viewMode}
        onViewModeChange={calendar.setViewMode}
        headerText={headerText}
        isCurrentPeriod={calendar.isCurrentPeriod}
        clipboard={calendar.clipboard}
        onClearClipboard={calendar.clearClipboard}
        onGoToToday={calendar.goToToday}
        onGoPrevious={calendar.goToPrevious}
        onGoNext={calendar.goToNext}
        onOpenShareModal={onOpenShareModal}
        onOpenCopyWeeksModal={calendar.openCopyWeeksModal}
      />

      {/* Week View - Desktop */}
      {calendar.viewMode === 'week' && (
        <WeekView
          weekDates={calendar.weekDates}
          loading={calendar.loading}
          clipboard={calendar.clipboard}
          draggedMeal={calendar.draggedMeal}
          dragOverSlot={calendar.dragOverSlot}
          getMealsForSlot={calendar.getMealsForSlot}
          isToday={calendar.isToday}
          isPast={calendar.isPast}
          onDragStart={calendar.handleDragStart}
          onDragEnd={calendar.handleDragEnd}
          onDragOver={calendar.handleDragOver}
          onDragLeave={calendar.handleDragLeave}
          onDrop={calendar.handleDrop}
          onPaste={calendar.handlePaste}
          onCopy={calendar.handleCopy}
          onCut={calendar.handleCut}
          onRepeat={calendar.handleOpenRepeatModal}
          onDelete={calendar.handleDeleteMeal}
          onEdit={calendar.handleOpenEditModal}
          onSlotClick={calendar.handleSlotClick}
        />
      )}

      {/* Week View - Mobile (3-day) */}
      {calendar.viewMode === 'week' && (
        <MobileWeekView
          dates={calendar.mobile3DayDates}
          offset={calendar.mobile3DayOffset}
          loading={calendar.loading}
          selectedMealForActions={calendar.selectedMealForActions}
          getMealsForDate={calendar.getMealsForDate}
          getMealsForSlot={calendar.getMealsForSlot}
          isToday={calendar.isToday}
          isPast={calendar.isPast}
          onGoPrev={calendar.goMobile3DayPrev}
          onGoNext={calendar.goMobile3DayNext}
          onGoToday={calendar.goMobile3DayToday}
          onToggleMealActions={calendar.toggleMealActions}
          onClearMealActions={calendar.closeMealActions}
          onMove={calendar.handleOpenMoveModal}
          onRepeat={calendar.handleOpenRepeatModal}
          onDelete={calendar.handleDeleteMeal}
          onEdit={calendar.handleOpenEditModal}
          onSlotClick={calendar.handleSlotClick}
        />
      )}

      {/* Day View */}
      {calendar.viewMode === 'day' && (
        <DayView
          date={calendar.currentDate}
          loading={calendar.loading}
          getMealsForSlot={calendar.getMealsForSlot}
          isToday={calendar.isToday}
          isPast={calendar.isPast}
          onRepeat={calendar.handleOpenRepeatModal}
          onDelete={calendar.handleDeleteMeal}
          onEdit={calendar.handleOpenEditModal}
          onSlotClick={calendar.handleSlotClick}
        />
      )}

      {/* Month View */}
      {calendar.viewMode === 'month' && (
        <MonthView
          monthDates={calendar.monthDates}
          currentDate={calendar.currentDate}
          loading={calendar.loading}
          selectedMealForActions={calendar.selectedMealForActions}
          mobileSelectedDate={calendar.mobileSelectedDate}
          getMealsForDate={calendar.getMealsForDate}
          getMealsForSlot={calendar.getMealsForSlot}
          isToday={calendar.isToday}
          isPast={calendar.isPast}
          isSameMonth={(date1, date2) => isCurrentMonth(date1, date2)}
          onSlotClick={calendar.handleSlotClick}
          onSelectMobileDate={calendar.setMobileSelectedDate}
          onToggleMealActions={calendar.toggleMealActions}
          onClearMealActions={calendar.closeMealActions}
          onMove={calendar.handleOpenMoveModal}
          onRepeat={calendar.handleOpenRepeatModal}
          onDelete={calendar.handleDeleteMeal}
          onEdit={calendar.handleOpenEditModal}
        />
      )}

      {/* Empty state */}
      {!calendar.loading && calendar.mealPlans.length === 0 && (
        <div className="text-center py-8">
          <p className="text-warm-gray">Click on a slot to add a recipe to your meal plan.</p>
        </div>
      )}

      {/* Add Meal Modal (unified - recipe or custom) */}
      <AddMealModal
        isOpen={calendar.isAddModalOpen}
        onClose={calendar.closeAddModal}
        onSelectRecipe={calendar.handleSelectRecipe}
        onCustomMealSuccess={calendar.handleCustomMealSuccess}
        selectedDate={calendar.selectedSlot?.date}
        selectedMealType={calendar.selectedSlot?.mealType}
        defaultCalendarId={calendar.getDefaultCalendarId()}
      />

      {/* Copy Weeks Modal */}
      <Modal isOpen={calendar.showCopyWeeksModal} onClose={calendar.closeCopyWeeksModal} size="md">
        <div className="bg-white rounded-xl shadow-2xl p-6">
          <h2 className="font-serif text-xl text-charcoal mb-4">Copy This Week</h2>
          <p className="text-warm-gray text-sm mb-4">
            Copy all meals from this week to future weeks. Existing meals will not be overwritten.
          </p>
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm text-charcoal">Copy to next</label>
            <select
              value={calendar.copyWeeksCount}
              onChange={(e) => calendar.setCopyWeeksCount(Number(e.target.value))}
              className="px-3 py-1.5 border border-border rounded-lg text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} week{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={calendar.closeCopyWeeksModal}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-charcoal hover:bg-cream transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={calendar.handleCopyWeeks}
              disabled={calendar.copyingWeeks}
              className="flex-1 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              {calendar.copyingWeeks ? 'Copying...' : 'Copy Meals'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Servings Modal */}
      {calendar.editingMeal && (
        <Modal isOpen={calendar.showEditModal} onClose={calendar.closeEditModal} size="sm">
          <div className="bg-white rounded-xl shadow-2xl p-6">
            <h2 className="font-serif text-xl text-charcoal mb-1">Edit Servings</h2>
            <p className="text-warm-gray text-sm mb-5 truncate">
              {calendar.editingMeal.recipe?.title || calendar.editingMeal.custom_title}
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => calendar.setEditServings(Math.max(1, calendar.editServings - 1))}
                className="w-10 h-10 rounded-lg bg-cream hover:bg-cream-dark text-charcoal text-xl flex items-center justify-center transition-colors"
              >−</button>
              <span className="w-12 text-center text-2xl font-serif text-charcoal">{calendar.editServings}</span>
              <button
                onClick={() => calendar.setEditServings(calendar.editServings + 1)}
                className="w-10 h-10 rounded-lg bg-cream hover:bg-cream-dark text-charcoal text-xl flex items-center justify-center transition-colors"
              >+</button>
            </div>
            <div className="flex gap-3">
              <button onClick={calendar.closeEditModal} className="flex-1 px-4 py-2 border border-border rounded-lg text-charcoal hover:bg-cream transition-colors">
                Cancel
              </button>
              <button
                onClick={calendar.handleSaveServings}
                disabled={calendar.savingServings}
                className="flex-1 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                {calendar.savingServings ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Repeat Weekly Modal */}
      {calendar.repeatMeal && calendar.repeatMeal.recipe && (
        <Modal isOpen={calendar.showRepeatModal} onClose={calendar.closeRepeatModal} size="md">
          <div className="bg-white rounded-xl shadow-2xl p-6">
            <h2 className="font-serif text-xl text-charcoal mb-1">Repeat Weekly</h2>
            <p className="text-warm-gray text-sm mb-4">
              Add <strong>{calendar.repeatMeal.recipe.title}</strong> for{' '}
              <span className="capitalize">{calendar.repeatMeal.meal_type}</span>.
            </p>

            {/* Day of week selector */}
            <div className="mb-4">
              <label className="block text-sm text-charcoal mb-2">On these days</label>
              <div className="flex gap-1.5">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                  const selected = calendar.repeatDaysOfWeek.includes(i);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        const days = calendar.repeatDaysOfWeek;
                        calendar.setRepeatDaysOfWeek(
                          selected ? days.filter(d => d !== i) : [...days, i].sort()
                        );
                      }}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        selected ? 'bg-gold text-white' : 'border border-border text-warm-gray hover:bg-cream'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <label className="text-sm text-charcoal">For the next</label>
              <select
                value={calendar.repeatWeeksCount}
                onChange={(e) => calendar.setRepeatWeeksCount(Number(e.target.value))}
                className="px-3 py-1.5 border border-border rounded-lg text-sm"
              >
                {[2, 4, 6, 8, 12].map(n => (
                  <option key={n} value={n}>{n} weeks</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={calendar.closeRepeatModal}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-charcoal hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={calendar.handleCreateRecurring}
                disabled={calendar.creatingRecurring || calendar.repeatDaysOfWeek.length === 0}
                className="flex-1 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                {calendar.creatingRecurring ? 'Creating...' : `Create${calendar.repeatDaysOfWeek.length > 1 ? ` (${calendar.repeatDaysOfWeek.length} days/wk)` : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Move Meal Modal (Mobile) */}
      {calendar.mealToMove && (
        <Modal isOpen={calendar.showMoveModal} onClose={calendar.closeMoveModal} size="md" position="bottom-sheet">
          <div className="bg-white rounded-t-xl md:rounded-xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="font-serif text-xl text-charcoal mb-4">
              Move {calendar.mealToMove.recipe?.title || calendar.mealToMove.custom_title}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-charcoal mb-2">Select date</label>
                <input
                  type="date"
                  value={calendar.moveDestination ? calendar.moveDestination.date.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = new Date(e.target.value + 'T00:00:00');
                    calendar.setMoveDestination({
                      date,
                      mealType: calendar.moveDestination?.mealType || calendar.mealToMove!.meal_type
                    });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-charcoal mb-2">Meal type</label>
                <div className="flex gap-2">
                  {MEAL_TYPES.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => calendar.setMoveDestination({
                        date: calendar.moveDestination?.date || new Date(),
                        mealType: key
                      })}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                        calendar.moveDestination?.mealType === key
                          ? 'bg-gold text-white'
                          : 'border border-border text-charcoal hover:bg-cream'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={calendar.closeMoveModal}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-charcoal hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={calendar.handleMoveMeal}
                disabled={!calendar.moveDestination}
                className="flex-1 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                Move
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
